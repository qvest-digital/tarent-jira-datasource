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
import * as d3 from 'd3';
import * as localforage from "localforage";

export class DataSource extends DataSourceApi<JiraQuery, MyDataSourceOptions> {

    routePath = '/tarent';
    url?: string;
    cacheStore = localforage.createInstance({
        name: 'myCacheStore'
    });

    constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
        super(instanceSettings);
        this.url = instanceSettings.url;
    }

    private async doCachedRequest<T>(url: string, params?: any): Promise<T> {
        let urlWithParams = url + "?" + new URLSearchParams(params).toString()
        // Try to retrieve the data from the cache
        const cachedData = await this.cacheStore.getItem(urlWithParams);

        if (cachedData !== null) {
            // If the data is found in the cache, return it
            console.log('Data found in cache');
            return Promise.resolve(cachedData as T);
        }

        let response =  getBackendSrv().get<T>(url, {...params})
        // Store the data in the cache for future use
        await this.cacheStore.setItem(urlWithParams, response);
        console.log('Data stored in cache');
        return  response
    }

    async doChangelogRequest(query: JiraQuery): Promise<Issue[]> {
        const fullpath = this.url + this.routePath + "/rest/api/2/search"
        let responses: Array<Promise<SearchResults>> = []

        const params = {jql: query.jqlQuery, expand: 'changelog', fields: "key,name,changelog,issuetype"}

        let firstResponse = this.doCachedRequest<SearchResults>(fullpath, {startAt: 0, ...params})
        responses = responses.concat(firstResponse)
        const firstPage = await firstResponse

        // if there is more than one result page, fetch the other pages asynchronously to speed things up
        if (firstPage.total! > firstPage.maxResults!){
            let numberOfPages = Math.ceil(firstPage.total! / firstPage.maxResults!)
            for (let i=1; i <= numberOfPages; i++){
                const currentStartAt = i * firstPage.maxResults!
                responses = responses.concat(this.doCachedRequest<SearchResults>(fullpath, {startAt: currentStartAt, ...params}))
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
                case 'changelogRaw':
                    return await this.getChangelogRawData(target);
                case 'cycletime':
                    return await this.getCycletimeData(target);
                default:
                    throw Error("no metric selected")
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
                {name: 'EndStatus', type: FieldType.string},
                {name: 'EndStatusCreated', type: FieldType.time},
                {name: 'CycleTime', type: FieldType.number},
                {name: 'Quantil', type: FieldType.number},
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
                                let row: unknown[] = [issueKey, issueType, target.startStatus, target.endStatus, endCreated, cycletime]
                                frame.appendRow(row);
                            }
                        }
                    })
                })
            })
        })
        const cycletimeField = frame.fields.find((field) => field.name === 'CycleTime');
        const quantil = d3.quantile(cycletimeField?.values.toArray() as number[], target.quantil / 100)
        const quantilField = frame.fields.find((field) => field.name === 'Quantil');
        quantilField?.values.set(0, quantil)

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
