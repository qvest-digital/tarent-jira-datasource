import {JiraQuery} from "./types";
import {Issue, SearchResults} from "jira.js/out/version2/models";
import {doCachedRequest} from "./cache";
import {getBackendSrv} from "@grafana/runtime";

export class JiraRequest {

    private routePath = '/tarent';

    constructor(public url: string) {}

    async doSearchRequest(query: JiraQuery): Promise<Issue[]> {
        const fullpath = this.url + this.routePath + "/rest/api/2/search"
        let responses: Array<Promise<SearchResults>> = []

        const params = {jql: query.jqlQuery}

        let firstResponse = doCachedRequest<SearchResults>(fullpath, {startAt: 0, ...params})
        responses = responses.concat(firstResponse)
        const firstPage = await firstResponse

        // if there is more than one result page, fetch the other pages asynchronously to speed things up
        if (firstPage.total! > firstPage.maxResults!) {
            let numberOfPages = Math.ceil(firstPage.total! / firstPage.maxResults!)
            for (let i = 1; i <= numberOfPages; i++) {
                const currentStartAt = i * firstPage.maxResults!
                responses = responses.concat(doCachedRequest<SearchResults>(fullpath, {startAt: currentStartAt, ...params}))
            }
        }
        let issues: Issue[] = (await Promise.all(responses)).reduce(
            (accumulator, currentValue) => accumulator = accumulator.concat(currentValue.issues!),
            [] as Issue[]
        );

        if (issues.length !== firstPage.total!) {
            throw new Error(`ISSUES_TOTAL_FETCH_ERROR: There is a total of ${firstPage.total} issues but only ${issues.length} could be fetched`);
        }

        return issues
    }

    async doChangelogRequest(query: JiraQuery, additionalFields?: string[]): Promise<Issue[]> {
        const fullpath = this.url + this.routePath + "/rest/api/2/search"
        let responses: Array<Promise<SearchResults>> = []

        const params = {jql: query.jqlQuery, expand: 'changelog', fields: "key,name,changelog,issuetype" + (additionalFields? ',' + additionalFields?.join(',') : '')}

        let firstResponse = doCachedRequest<SearchResults>(fullpath, {startAt: 0, ...params})
        responses = responses.concat(firstResponse)
        const firstPage = await firstResponse

    // if there is more than one result page, fetch the other pages asynchronously to speed things up
        if (firstPage.total! > firstPage.maxResults!) {
            let numberOfPages = Math.ceil(firstPage.total! / firstPage.maxResults!)
            for (let i = 1; i <= numberOfPages; i++) {
                const currentStartAt = i * firstPage.maxResults!
                responses = responses.concat(doCachedRequest<SearchResults>(fullpath, {startAt: currentStartAt, ...params}))
            }
        }
        let issues: Issue[] = (await Promise.all(responses)).reduce(
            (accumulator, currentValue) => accumulator = accumulator.concat(currentValue.issues!),
            [] as Issue[]
        );

        if (issues.length !== firstPage.total!) {
            throw new Error(`ISSUES_TOTAL_FETCH_ERROR: There is a total of ${firstPage.total} issues but only ${issues.length} could be fetched`);
        }

        return issues
    }

    async doTestRequest() {
        const fullpath = this.url + this.routePath + "/rest/api/2/myself"
        return await getBackendSrv().get(fullpath)
    }
}
