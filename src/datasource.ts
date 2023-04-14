import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MutableDataFrame,
    FieldType,
} from '@grafana/data';
import {getBackendSrv} from '@grafana/runtime';

import {MyQuery, MyDataSourceOptions} from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {

    routePath = '/tarent';
    url?: string;

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);
        this.url = instanceSettings.url;
    }

    async doRequest(query: MyQuery) {
        const fullpath = this.url + this.routePath + "rest/api/2/search?jql=assignee=mmeltz&expand=changelog"
        const result = await getBackendSrv().get(fullpath)

        return result;
    }

    async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
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

                            frame.appendRow([issueKey, issueType, created, field, fromString,toString ]);
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
}
