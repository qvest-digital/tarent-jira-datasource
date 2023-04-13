import React, {ChangeEvent} from 'react';
import {InlineField, Input, Select} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {DataSource} from '../datasource';
import {MyDataSourceOptions, MyQuery} from '../types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;


export function QueryEditor({query, onChange, onRunQuery}: Props) {
    const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, queryText: event.target.value});
    };

    const onQuantilChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange({...query, quantil: parseFloat(event.target.value)});
        // executes the query
        onRunQuery();
    };
    const onStartStatusChange = (value: SelectableValue) => {
        onChange({...query, startStatus: value.value});
        // executes the query
        onRunQuery();
    };

    //TODO this must be an
    const options = [
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Done', label: 'Done' },
        { value: 'New', label: 'New' }
    ]

    const onEndStatusChange = (value: SelectableValue) => {
        onChange({...query, endStatus: value.value});
        // executes the query
        onRunQuery();
    };


    const {queryText, quantil, startStatus, endStatus} = query;

    return (
        <div className="gf-form">
            <InlineField label="StartStatus">
                <Select onChange={onStartStatusChange} value={startStatus} options={options} />
            </InlineField>
            <InlineField label="EndStatus">
                <Select onChange={onEndStatusChange} value={endStatus} options={options}/>
            </InlineField>
            <InlineField label="Quantil">
                <Input onChange={onQuantilChange} value={quantil} width={8} type="number"/>
            </InlineField>
            <InlineField label="JQl Text" labelWidth={16} tooltip="Which JQL should be used?">
                <Input onChange={onQueryTextChange} placeholder={'insert the JQL Query here'} value={queryText || ''}/>
            </InlineField>
        </div>
    );
}
