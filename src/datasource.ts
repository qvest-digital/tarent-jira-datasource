import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MutableDataFrame,
    FieldType,
} from '@grafana/data';
import {getBackendSrv} from '@grafana/runtime';

import {JiraQuery, MyDataSourceOptions, QueryTypesResponse, StatusTypesResponse} from './types';
import {Changelog, Issue, SearchResults} from "jira.js/out/version2/models";

export class DataSource extends DataSourceApi<JiraQuery, MyDataSourceOptions> {

    routePath = '/tarent';
    url?: string;

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);
        this.url = instanceSettings.url;
    }

    async doChangelogRequest(query: JiraQuery): Promise<Issue[]> {
        const fullpath = this.url + this.routePath + "/rest/api/2/search"

        let response: SearchResults
        let startAt = 0
        let result: Issue[] = []
        do {
            response = await getBackendSrv().get<SearchResults>(fullpath, {startAt: startAt, jql: query.jqlQuery, expand: 'changelog'})
            startAt = response.startAt! + response.maxResults!
            result = result.concat(response.issues!)
        } while (startAt < response.total!)
        return result;
    }

    async query(options: DataQueryRequest<JiraQuery>): Promise<DataQueryResponse> {
        const promises = options.targets.map(async (target) => {
            switch (target.metric) {
                case 'changelogRaw':
                    return await this.getChangelogRawData(target);
                case 'cycletime':
                    return await this.getCycletimeData(target);
            }
            return new MutableDataFrame({
                refId: target.refId,
                fields: [],
            });
        });

        return Promise.all(promises).then((data) => ({data}));
    }

    private async getCycletimeData(target: JiraQuery) {
        const frame = new MutableDataFrame({
            refId: target.refId,
            fields: [
                {name: 'IssueKey', type: FieldType.string},
                {name: 'IssueType', type: FieldType.string},
                {name: 'StartStatus', type: FieldType.string},
                {name: 'StartStatusCreated', type: FieldType.time},
                {name: 'EndStatus', type: FieldType.string},
                {name: 'EndStatusCreated', type: FieldType.time},
                {name: 'CycleTime', type: FieldType.number},
            ],
        });

        await this.doChangelogRequest(target).then(issues => {
            issues.forEach((issue: Issue) => {
                let issueKey = issue.key
                let issueType = issue.fields.issuetype.name
                let startCreated: any
                let endCreated: any
                issue.changelog?.histories?.forEach((historyy: Changelog) => {
                    let created = new Date(historyy.created ? historyy.created : "")
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
                                let row: unknown[] = [issueKey, issueType, target.startStatus, startCreated, target.endStatus, endCreated, cycletime]
                                frame.appendRow(row);
                            }
                        }
                    })
                })
            })
        })

        return frame;
    }


    private async getChangelogRawData(target: JiraQuery) {
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
        const result = await getBackendSrv().get(fullpath)

        return result;
    }

    getAvailableMetricTypes(): Promise<QueryTypesResponse> {
        const metrics = [
            {value: 'cycletime', label: 'cycle time'},
            {value: 'changelogRaw', label: 'change log - raw data'},
            {value: 'none', label: 'None'},
        ]

        return Promise.resolve({queryTypes: metrics});
    }

    getAvailableStartStatus(): Promise<StatusTypesResponse> {
        //TODO this must be an
        const options = [
            {value: 'In Progress', label: 'In Progress'},
            {value: 'Done', label: 'Done'},
            {value: 'New', label: 'New'}
        ]

        return Promise.resolve({statusTypes: options});
    }

    getAvailableEndStatus(): Promise<QueryTypesResponse> {
        //TODO this must be an
        const options = [
            {value: 'In Progress', label: 'In Progress'},
            {value: 'Done', label: 'Done'},
            {value: 'New', label: 'New'}
        ]

        return Promise.resolve({queryTypes: options});
    }
}
