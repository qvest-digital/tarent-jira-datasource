import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  quantil: number;
  startStatus: string;
  endStatus: string;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  quantil: 0.85,
  startStatus: 'in Progress',
  endStatus: 'Done',
};

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
