import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MutableDataFrame,
    FieldType,
    DataFrameView,
} from '@grafana/data';
import {getBackendSrv, getTemplateSrv} from '@grafana/runtime';

import {JiraQuery, METRICS, MyDataSourceOptions, QueryTypesResponse, StatusTypesResponse} from './types';
import {Changelog, Issue, SearchResults} from "jira.js/out/version2/models";
import * as d3 from 'd3';
import {doCachedRequest} from "./cache";

export class DataSource extends DataSourceApi<JiraQuery, MyDataSourceOptions> {

    routePath = '/tarent';
    url?: string;

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);
        this.url = instanceSettings.url;
    }

    async doChangelogRequest(query: JiraQuery): Promise<Issue[]> {
        const fullpath = this.url + this.routePath + "/rest/api/2/search"
        let responses: Array<Promise<SearchResults>> = []

        const params = {jql: query.jqlQuery, expand: 'changelog', fields: "key,name,changelog,issuetype"}

        let firstResponse = doCachedRequest<SearchResults>(fullpath, {startAt: 0, ...params})
        responses = responses.concat(firstResponse)
        const firstPage = await firstResponse

        // if there is more than one result page, fetch the other pages asynchronously to speed things up
        if (firstPage.total! > firstPage.maxResults!){
            let numberOfPages = Math.ceil(firstPage.total! / firstPage.maxResults!)
            for (let i=1; i <= numberOfPages; i++){
                const currentStartAt = i * firstPage.maxResults!
                responses = responses.concat(doCachedRequest<SearchResults>(fullpath, {startAt: currentStartAt, ...params}))
            }
        }
        let issues: Issue[] = (await Promise.all(responses)).reduce(
            (accumulator, currentValue) => accumulator = accumulator.concat(currentValue.issues!),
            [] as Issue[]
          );

        if (issues.length !== firstPage.total!){
            throw new Error(`ISSUES_TOTAL_FETCH_ERROR: There is a total of ${firstPage.total} issues but only ${issues.length} could be fetched`);
        }

        return issues
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
                default:
                    throw Error("no metric selected")
            }
        });

        return Promise.all(promises).then((data) => ({data}));
    }

    private async getThroughputData(target: JiraQuery): Promise<MutableDataFrame<any>> {
        const frame = new MutableDataFrame({
            refId: target.refId,
            fields: [
                {name: 'CW', type: FieldType.string},
                {name: 'count', type: FieldType.number},

            ],
        });

        await this.doChangelogRequest(target).then(issues => {
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

        await this.doChangelogRequest(target).then(issues => {
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
        const cycletimeField = frame.fields.find((field) => field.name === 'CycleTime');
        const quantile = d3.quantile(cycletimeField?.values.toArray() as number[], target.quantile / 100)
        const quantileField = frame.fields.find((field) => field.name === 'Quantile');
        for (let i = 0; i < quantileField!.values.length; i++) {
            quantileField?.values.set(i, quantile)
        }

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

        await this.doChangelogRequest(target).then(issues => {
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
        const fullpath = this.url + this.routePath + "/rest/api/2/myself"
        return await getBackendSrv().get(fullpath)
    }

    getAvailableMetricTypes(): Promise<QueryTypesResponse> {
        const metrics = [
            {value: METRICS.CYCLE_TIME, label: 'cycle time'},
            {value: METRICS.THROUGHPUT, label: 'throughput'},
            {value: METRICS.CHANGELOG_RAW, label: 'change log - raw data'},
            {value: METRICS.NONE, label: 'None'},
        ]

        return Promise.resolve({queryTypes: metrics});
    }

    async getAvailableStatus(query: JiraQuery, fieldName: string): Promise<StatusTypesResponse> {
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
