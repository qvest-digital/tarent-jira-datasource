import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MutableDataFrame,
    FieldType,
    DataFrameView,
} from '@grafana/data';
import {getTemplateSrv} from '@grafana/runtime';

import {JiraQuery, METRICS, MyDataSourceOptions, QueryTypesResponse, StatusTypesResponse} from './types';
import {Changelog, Issue} from "jira.js/out/version2/models";
import * as d3 from 'd3';
import {JiraRequest } from "./JiraRequest";

export function computeQuantileValueByFieldName(frame: MutableDataFrame<any>, fieldName: string, quantile: number) {
    const searchedField = frame.fields.find((field) => field.name === fieldName);
    if (!searchedField) {
        throw new Error("field " + searchedField + " was not found")
    }
    return d3.quantile(searchedField.values.toArray() as number[], quantile / 100)
}

export class DataSource extends DataSourceApi<JiraQuery, MyDataSourceOptions> {

    private jira

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);
        this.jira = new JiraRequest(instanceSettings.url!);
    }


    async query(options: DataQueryRequest<JiraQuery>): Promise<DataQueryResponse> {
        const promises = options.targets.map(async (target) => {
            switch (target.metric) {
                case METRICS.CHANGELOG_RAW:
                    return await this.getChangelogRawData(target);
                case METRICS.CYCLE_TIME:
                    return await this.getCycletimeData(target);
                case METRICS.THROUGHPUT:
                    return await this.getThroughputData(target);
                case METRICS.WORK_ITEM_AGE:
                    return await this.getWorkItemAge(target);
                case METRICS.RAW_DATA:
                    return await this.getRawData(target);
                default:
                    throw Error("no metric selected")
            }
        });

        return Promise.all(promises).then((data) => ({data}));
    }

    private async getWorkItemAge(jiraQuery: JiraQuery): Promise<MutableDataFrame<any>> {
        const frame = new MutableDataFrame({
            refId: jiraQuery.refId,
            fields: [
                {name: 'IssueKey', type: FieldType.string},
                {name: 'IssueType', type: FieldType.string},
                {name: 'Status', type: FieldType.string},
                {name: 'StatusCreated', type: FieldType.time},
                {name: 'Age', type: FieldType.number},
                {name: 'Quantile', type: FieldType.number},
            ],
        });

        await this.jira.doChangelogRequest(jiraQuery, ['status']).then(issues => {
            const fromDate: Date = new Date(getTemplateSrv().replace("${__from:date:iso}"))
            const toDate: Date =  new Date(getTemplateSrv().replace("${__to:date:iso}"))

            issues.forEach((issue: Issue) => {
                let status = issue.fields.status.name
                if (status !== jiraQuery.status) { return }
                let issueKey = issue.key
                let issueType = issue.fields.issuetype.name
                let endCreated: any
                issue.changelog?.histories?.forEach((historyy: Changelog) => {
                    let created = new Date(historyy.created ? historyy.created : "")
                    if (created < fromDate || created > toDate ) {
                        return ;
                    }
                    historyy.items?.forEach((item: any) => {
                        if (item.field === 'status') {
                            if (item.toString === jiraQuery.status) {
                                if (endCreated == null || endCreated < created) {
                                    endCreated = created
                                }
                            }
                        }
                    })
                })
                if (endCreated) {
                    let diff = Math.abs(endCreated.getTime() - new Date().getTime());
                    let age = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
                    let row: unknown[] = [issueKey, issueType, jiraQuery.status,endCreated, age]
                    frame.appendRow(row);
                }
            })
        })
        const quantile = computeQuantileValueByFieldName(frame, 'Age', jiraQuery.quantile);
        const quantileField = frame.fields.find((field) => field.name === 'Quantile');
        for (let i = 0; i < quantileField!.values.length; i++) {
            quantileField?.values.set(i, quantile)
        }

        return frame;
    }

    private async getThroughputData(target: JiraQuery): Promise<MutableDataFrame<any>> {
        const frame = new MutableDataFrame({
            refId: target.refId,
            fields: [
                {name: 'CW', type: FieldType.string},
                {name: 'count', type: FieldType.number},

            ],
        });

        await this.jira.doChangelogRequest(target).then(issues => {
            const fromDate: Date = new Date(getTemplateSrv().replace("${__from:date:iso}"))
            const toDate: Date =  new Date(getTemplateSrv().replace("${__to:date:iso}"))
            let dataMap = new Map<string, number>()
            d3.timeWeek.range(fromDate, toDate).forEach(value => {
                let cw = d3.timeSunday.count(d3.timeYear(value), value)
                let cwYear = value.getFullYear().toString() + "-" + (cw < 10 ? 0 : '') + cw
                dataMap.set(cwYear, 0)
            })

            issues.forEach((issue: Issue) => {
                let endCreated: Date
                issue.changelog?.histories?.forEach((historyy: Changelog) => {
                    let created = new Date(historyy.created ? historyy.created : "")
                    if (created < fromDate || created > toDate ) {
                        return ;
                    }
                    historyy.items?.forEach((item: any) => {
                        if (item.field === 'status') {
                            if (item.toString === target.endStatus) {
                                endCreated = created
                                let cw = d3.timeSunday.count(d3.timeYear(endCreated), endCreated)
                                let cwYear = endCreated.getFullYear().toString() + "-" + (cw < 10 ? 0 : '') + cw
                                dataMap.set(cwYear, dataMap.get(cwYear)! + 1)
                            }
                        }
                    })

                })
            })
            new Map([...dataMap.entries()].sort()).forEach((value, key) => {
                frame.appendRow([key, value])
            })
        })
        return frame;
    }

    private async getCycletimeData(target: JiraQuery) {
        const frame = new MutableDataFrame({
            refId: target.refId,
            fields: [
                {name: 'IssueKey', type: FieldType.string},
                {name: 'IssueType', type: FieldType.string},
                {name: 'StartStatus', type: FieldType.string},
                {name: 'EndStatus', type: FieldType.string},
                {name: 'EndStatusCreated', type: FieldType.time},
                {name: 'CycleTime', type: FieldType.number},
                {name: 'Quantile', type: FieldType.number},
            ],
        });

        await this.jira.doChangelogRequest(target).then(issues => {
            const fromDate: Date = new Date(getTemplateSrv().replace("${__from:date:iso}"))
            const toDate: Date =  new Date(getTemplateSrv().replace("${__to:date:iso}"))

            issues.forEach((issue: Issue) => {
                let issueKey = issue.key
                let issueType = issue.fields.issuetype.name
                let startCreated: any
                let endCreated: any
                issue.changelog?.histories?.forEach((historyy: Changelog) => {
                    let created = new Date(historyy.created ? historyy.created : "")
                    if (created < fromDate || created > toDate ) {
                        return ;
                    }
                    historyy.items?.forEach((item: any) => {
                        if (item.field === 'status') {
                            if (item.toString === target.startStatus) {
                                startCreated = created
                            }
                            if (item.toString === target.endStatus) {
                                endCreated = created
                            }
                            if (startCreated && endCreated) {
                                let diff = Math.abs(endCreated.getTime() - startCreated.getTime());
                                let cycletime = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
                                let row: unknown[] = [issueKey, issueType, target.startStatus, target.endStatus, endCreated, cycletime]
                                frame.appendRow(row);
                            }
                        }
                    })
                })
            })
        })
        const quantile = computeQuantileValueByFieldName(frame, 'CycleTime', target.quantile);
        const quantileField = frame.fields.find((field) => field.name === 'Quantile');
        for (let i = 0; i < quantileField!.values.length; i++) {
            quantileField?.values.set(i, quantile)
        }

        return frame;
    }

    private async getRawData(target: JiraQuery): Promise<MutableDataFrame> {
        const frame = new MutableDataFrame({
            refId: target.refId,
            fields: [
                {name: 'IssueKey', type: FieldType.string},
                {name: 'IssueType', type: FieldType.string},
                {name: 'Status', type: FieldType.string},
            ],
        });
        await this.jira.doSearchRequest(target).then(issues => {
            issues.forEach((issue: any) => {
                let issueKey = issue.key
                let issueType = issue.fields.issuetype.name
                let status = issue.fields.status.name
                frame.appendRow([issueKey, issueType, status]);
            })
        })

        return frame;
    }

    private async getChangelogRawData(target: JiraQuery): Promise<MutableDataFrame> {
        const frame = new MutableDataFrame({
            refId: target.refId,
            fields: [
                {name: 'IssueKey', type: FieldType.string},
                {name: 'IssueType', type: FieldType.string},
                {name: 'Created', type: FieldType.time},
                {name: 'field', type: FieldType.string},
                {name: 'fromValue', type: FieldType.string},
                {name: 'toValue', type: FieldType.string},
            ],
        });

        await this.jira.doChangelogRequest(target).then(issues => {
            issues.forEach((issue: any) => {
                let issueKey = issue.key
                let issueType = issue.fields.issuetype.name
                issue.changelog.histories.forEach((historyy: any) => {
                    let created = historyy.created
                    historyy.items.forEach((item: any) => {
                        let field = item.field
                        let fromString = item.fromString
                        let toString = item.toString

                        frame.appendRow([issueKey, issueType, created, field, fromString, toString]);
                    })
                })
            })
        })

        return frame;
    }

    async testDatasource() {
        return this.jira.doTestRequest();
    }

    getAvailableMetricTypes(): Promise<QueryTypesResponse> {
        const metrics = [
            {value: METRICS.CYCLE_TIME, label: 'cycle time'},
            {value: METRICS.THROUGHPUT, label: 'throughput'},
            {value: METRICS.WORK_ITEM_AGE, label: 'work item age'},
            {value: METRICS.CHANGELOG_RAW, label: 'change log - raw data'},
            {value: METRICS.RAW_DATA, label: 'raw data'},
        ]

        return Promise.resolve({queryTypes: metrics});
    }

    /**
     * get current available status
     * @param query
     */
    async getAvailableStatus(query: JiraQuery): Promise<StatusTypesResponse> {
        let data = await this.getRawData(query)

        const view = new DataFrameView(data);
        let options: Set<string> = new Set()
        view.forEach((row) => {
            options = options.add(row['Status'])
        });
        let formatedOptions: any = []
        options.forEach(option => formatedOptions.push({ 'value': option, 'label': option}))

        return Promise.resolve({statusTypes: formatedOptions});
    }

    /**
     * get status by changelog / historic values
     * @param query
     * @param fieldName
     */
    async getAvailableChangelogStatus(query: JiraQuery, fieldName: string): Promise<StatusTypesResponse> {
        let data = await this.getChangelogRawData(query)

        const view = new DataFrameView(data);
        let options: Set<string> = new Set()
        view.forEach((row) => {
            if (row.field === 'status') {
                options = options.add(row[fieldName])
            }
        });
        let formatedOptions: any = []
        options.forEach(option => formatedOptions.push({ 'value': option, 'label': option}))

        return Promise.resolve({statusTypes: formatedOptions});
    }
}
