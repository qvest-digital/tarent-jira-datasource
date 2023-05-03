import React, {ChangeEvent} from 'react';
import {InlineField, Input, Select} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {DataSource} from '../../datasource';
import {MyDataSourceOptions, JiraQuery, METRICS} from '../../types';
import {AsyncStatusTypeState, useMetricTypes, useStatus} from "./useQueryTypes";

type Props = QueryEditorProps<DataSource, JiraQuery, MyDataSourceOptions>;
type StatusSelectProps = {datasource: DataSource, query: JiraQuery, onChange: (value: JiraQuery) => void}

export function StartStatusSelect({datasource, query, onChange}: StatusSelectProps) {
    let asyncStatus: AsyncStatusTypeState = useStatus(datasource, query, 'fromValue');

    const onStatusChange = (value: SelectableValue) => {
        onChange({...query, startStatus: value.value});
    };

    return (
        <InlineField label={'Start Status'} required={true}>
            <Select onChange={onStatusChange} value={query.startStatus} options={asyncStatus.statusTypes} isLoading={asyncStatus.loading} disabled={!!asyncStatus.error}/>
        </InlineField>
    )
}

export function EndStatusSelect({datasource, query, onChange}: StatusSelectProps) {
    let asyncStatus: AsyncStatusTypeState = useStatus(datasource, query, 'toValue');

    const onStatusChange = (value: SelectableValue) => {
        onChange({...query, endStatus: value.value});
    };

    return (
        <InlineField label={'End Status'} required={true}>
            <Select onChange={onStatusChange} value={query.endStatus} options={asyncStatus.statusTypes} isLoading={asyncStatus.loading} disabled={!!asyncStatus.error}/>
        </InlineField>
    )
}

export function QueryEditor({datasource, query, onChange, onRunQuery}: Props) {

    const { loading, queryTypes, error } = useMetricTypes(datasource);

    const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, jqlQuery: event.target.value});
        // executes the query
        // onRunQuery();
    };

    const onQuantileChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, quantile: parseFloat(event.target.value)});
        // executes the query
        // onRunQuery();
    };

    const onMetricChange = (value: SelectableValue) => {
        onChange({...query, metric: value.value});
        // executes the query
        // onRunQuery();
    };

    const {jqlQuery, quantile, metric} = query;


    return (
        <div className="gf-form">
            <InlineField label="JQl Query" labelWidth={16} tooltip="Which JQL should be used? for example: project = 'FOOBAR' " invalid={!jqlQuery} error={"this field is required"} required={true}>
                <Input onChange={onQueryTextChange} placeholder={'insert the JQL Query here'} value={jqlQuery}  />
            </InlineField>
            <InlineField label="Metric" tooltip="Which metric you want to see? " invalid={!metric} error={"this field is required"} required={true}>
                <Select onChange={onMetricChange} value={metric} options={queryTypes} isLoading={loading} disabled={!!error} />
            </InlineField>
            {metric === METRICS.CYCLE_TIME
                ? <StartStatusSelect datasource={datasource}  onChange={onChange} query={query} ></StartStatusSelect>
                : ''
            }
            {metric === METRICS.CYCLE_TIME
                ? <EndStatusSelect datasource={datasource}  onChange={onChange}  query={query} ></EndStatusSelect>
                : ''
            }
            {metric === METRICS.CYCLE_TIME &&
            <InlineField label="Quantile" required={true}>
                <Input onChange={onQuantileChange} width={8} type="number" min={1} max={100} value={quantile}/>
            </InlineField>
            }
        </div>
    );
}
