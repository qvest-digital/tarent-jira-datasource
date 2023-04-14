import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MutableDataFrame,
    FieldType, SelectableValue, DataFrame, vectorator,
} from '@grafana/data';
import {getBackendSrv} from '@grafana/runtime';

import {JiraQuery, MyDataSourceOptions, QueryType, QueryTypesResponse, StatusTypesResponse} from './types';
import {uniqueId} from "lodash";

export class DataSource extends DataSourceApi<JiraQuery, MyDataSourceOptions> {

    routePath = '/tarent';
    url?: string;

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);
        this.url = instanceSettings.url;
    }

    async doRequest(query: JiraQuery) {
        const fullpath = this.url + this.routePath + "/rest/api/2/search?expand=changelog&jql=" + query.jqlQuery
        const result = await getBackendSrv().get(fullpath)

        return result;
    }

    async fetchFields(queryType: QueryType): Promise<SelectableValue[]> {
        const frame = await this.runQuery({ queryType });
        const ids = vectorator(frame?.fields[0]?.values ?? []);
        const names = frame?.fields[1]?.values;
        const types = frame?.fields[2]?.values;
        const items = frame?.fields[3]?.values;
        const customs = frame?.fields[4]?.values;
        const system = frame?.fields[5]?.values;
        const frameFields = ids
            .map((value, i) => ({
                value,
                text: names.get(i),
                label: names.get(i),
                type: types.get(i),
                items: items.get(i),
                custom: customs.get(i),
                system: system.get(i),
            }))
            .filter((f: any) => f.text != null);
        return frameFields.sort(this.sort);
    }

    private sort(a: SelectableValue, b: SelectableValue) {
        if (a.text < b.text) {
            return -1;
        }
        if (a.text > b.text) {
            return 1;
        }
        return 0;
    }

    private runQuery(request: Request | any): Promise<DataFrame> {
        return new Promise((resolve) => {
            const req = {
                targets: [{ ...request, refId: uniqueId(request.queryType ?? '') }],
            };
            this.query(req as unknown as DataQueryRequest<JiraQuery>).then((res) => {
                resolve(res.data[0] as DataFrame);
            });
        });
    }

    async query(options: DataQueryRequest<JiraQuery>): Promise<DataQueryResponse> {
        const promises = options.targets.map(async (target) => {
            const frame = new MutableDataFrame({
                refId: target.refId,
                fields: [
                    {name: 'IssueKey', type: FieldType.string},
                    {name: 'IssueType', type: FieldType.string},
                    {name: 'Created', type: FieldType.time},
                    {name: 'field', type: FieldType.string},
                    {name: 'fromValue', type: FieldType.string},
                    {name: 'toValue', type: FieldType.string},
                    { name: 'cycle_time', type: FieldType.number },
                ],
            });

            await this.doRequest(target).then(response => {
                response.issues.forEach((issue: any) => {
                    let issueKey = issue.key
                    let issueType = issue.fields.issuetype.name
                    issue.changelog.histories.forEach((historyy: any) => {
                        let created = historyy.created
                        historyy.items.forEach((item: any) => {
                            let field = item.field
                            let fromString = item.fromString
                            let toString = item.toString

                            frame.appendRow([issueKey, issueType, created, field, fromString,toString, Math.floor(Math.random() * 100) ]);
                        })
                    })
                })
            })

            return frame;
        });

        return Promise.all(promises).then((data) => ({data}));
    }

    async testDatasource() {
        const fullpath = this.url + this.routePath + "/rest/api/2/myself"
        const result = await getBackendSrv().get(fullpath)

        return result;
    }

    getAvailableMetricTypes(): Promise<QueryTypesResponse> {
        const metrics = [
            { value: 'cycletime', label: 'cycle time' },
            { value: 'changelogRaw', label: 'change log - raw data' },
            { value: 'none', label: 'None' },
        ]

        return Promise.resolve({queryTypes: metrics});
    }

    getAvailableStartStatus(): Promise<StatusTypesResponse> {
        //TODO this must be an
        const options = [
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Done', label: 'Done' },
            { value: 'New', label: 'New' }
        ]

        return Promise.resolve({statusTypes: options});
    }

    getAvailableEndStatus(): Promise<QueryTypesResponse> {
        //TODO this must be an
        const options = [
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Done', label: 'Done' },
            { value: 'New', label: 'New' }
        ]

        return Promise.resolve({queryTypes: options});
    }
}
