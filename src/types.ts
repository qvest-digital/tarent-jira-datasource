import {DataSourceJsonData, SelectableValue} from '@grafana/data';
import {DataQuery} from '@grafana/schema';

export interface JiraQuery extends DataQuery {
  jqlQuery: string;
  quantile: number;
  startStatus: string;
  endStatus: string;
  metric: string;
}


/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  token?: string;
}

export type QueryTypesResponse = {
  queryTypes: Array<SelectableValue<string>>;
};


export type StatusTypesResponse = {
  statusTypes: Array<SelectableValue<string>>;
};
