import { useAsync } from 'react-use';
import type { SelectableValue } from '@grafana/data';
import {DataSource} from "../../datasource";
import {JiraQuery} from "../../types";

type AsyncQueryTypeState = {
  loading: boolean;
  queryTypes: Array<SelectableValue<string>>;
  error: Error | undefined;
};

type AsyncStatusTypeState = {
  loading: boolean;
  statusTypes: Array<SelectableValue<string>>;
  error: Error | undefined;
};

export function useMetricTypes(datasource: DataSource): AsyncQueryTypeState {
  const result = useAsync(async () => {
    const { queryTypes } = await datasource.getAvailableMetricTypes();
    return queryTypes
  }, [datasource]);

  return {
    loading: result.loading,
    queryTypes: result.value ?? [],
    error: result.error,
  };
}

export function useStartStatus(datasource: DataSource, query: JiraQuery): AsyncStatusTypeState {
  const result = useAsync(async () => {
    const { statusTypes } = await datasource.getAvailableStartStatus(query);
    return statusTypes
  }, [datasource]);

  return {
    loading: result.loading,
    statusTypes: result.value ?? [],
    error: result.error,
  };
}

export function useEndStatus(datasource: DataSource,query: JiraQuery): AsyncStatusTypeState {
  const result = useAsync(async () => {
    const { queryTypes } = await datasource.getAvailableEndStatus(query);
    return queryTypes
  }, [datasource]);

  return {
    loading: result.loading,
    statusTypes: result.value ?? [],
    error: result.error,
  };
}
