import {DataQuery, DataSourceJsonData, SelectableValue} from '@grafana/data';

export interface JiraQuery extends DataQuery {
  jqlQuery?: string;
  quantil?: number;
  startStatus?: string;
  endStatus?: string;
  metric?: string;
}

export const DEFAULT_QUERY: Partial<JiraQuery> = {
  quantil: 0.85,
  startStatus: 'in Progress',
  endStatus: 'Done',
};

export enum QueryType {
  ISSUES = 'issues',
  PROJECTS = 'project',
  FIELDS = 'fields',
  FIELD_VALUES = 'fieldvalues', // cspell: disable-line
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
