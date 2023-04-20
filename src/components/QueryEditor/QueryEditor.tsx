import React, {ChangeEvent} from 'react';
import {InlineField, Input, Select} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {DataSource} from '../../datasource';
import {MyDataSourceOptions, JiraQuery} from '../../types';
import {useEndStatus, useMetricTypes, useStartStatus} from "./useQueryTypes";

type Props = QueryEditorProps<DataSource, JiraQuery, MyDataSourceOptions>;

export function QueryEditor({datasource, query, onChange, onRunQuery}: Props) {

    const { loading, queryTypes, error } = useMetricTypes(datasource);
    const asyncStartStatus = useStartStatus(datasource);
    const asyncEndStatus = useEndStatus(datasource);

    const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, jqlQuery: event.target.value});
    };

    const onQuantilChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, quantil: parseFloat(event.target.value)});
        // executes the query
        // onRunQuery();
    };
    const onStartStatusChange = (value: SelectableValue) => {
        onChange({...query, startStatus: value.value});
        // executes the query
        // onRunQuery();
    };

    const onEndStatusChange = (value: SelectableValue) => {
        onChange({...query, endStatus: value.value});
        // executes the query
        //onRunQuery();
    };

    const onMetricChange = (value: SelectableValue) => {
        onChange({...query, metric: value.value});
        // executes the query
        //onRunQuery();
    };

    const {jqlQuery, quantil, metric,  startStatus, endStatus} = query;

    return (
        <div className="gf-form">
            <InlineField label="JQl Query" labelWidth={16} tooltip="Which JQL should be used?">
                <Input onChange={onQueryTextChange} placeholder={'insert the JQL Query here'} value={jqlQuery || ''} required={true}/>
            </InlineField>
            <InlineField label="Metric">
                <Select onChange={onMetricChange} value={metric} options={queryTypes} isLoading={loading} disabled={!!error}/>
            </InlineField>
            {metric === "cycletime" &&
            <InlineField label="StartStatus">
                <Select onChange={onStartStatusChange} value={startStatus} options={asyncStartStatus.statusTypes} isLoading={asyncStartStatus.loading} disabled={!!asyncStartStatus.error}/>
            </InlineField>
            }
            {metric === "cycletime" &&
            <InlineField label="EndStatus">
                <Select onChange={onEndStatusChange} value={endStatus} options={asyncEndStatus.statusTypes} isLoading={asyncEndStatus.loading} disabled={!!asyncEndStatus.error}/>
            </InlineField>
            }
            {metric === "cycletime" &&
            <InlineField label="Quantil" >
                <Input onChange={onQuantilChange} value={quantil} width={8} type="number" min={1} max={100}/>
            </InlineField>
            }
        </div>
    );
}
