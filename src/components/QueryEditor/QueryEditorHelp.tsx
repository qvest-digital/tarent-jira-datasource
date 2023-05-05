import { QueryEditorHelpProps } from '@grafana/data';
import {JiraQuery, METRICS} from "../../types";
import React from "react";

export default function QueryEditorHelp(props: QueryEditorHelpProps<JiraQuery>): any {
    const examples = [
        {
            title: 'cycle time scatterplot',
            jqlQuery: "project = 'MAEN'",
            metric: METRICS.CYCLE_TIME,
            label: 'How many days are needed to complete the issues?',
            quantile: 85
        },
        {
            title: 'throughput',
            jqlQuery: "project = 'MAEN'",
            metric: METRICS.THROUGHPUT,
            label: 'How many issues are completed in one week?',
            endStatus: 'Done'
        },
        {
            title: 'work item age',
            jqlQuery: "project = 'MAEN'",
            metric: METRICS.WORK_ITEM_AGE,
            label: 'Shows a current snapshot of the aging of the current issues?'
        },
    ];

    return (
        <div>
            <h2>Cheat Sheet</h2>
            <p>which metric do you want to try? Please click on it and the wonder will happen</p>
            {examples.map((item, index) => (
                <div className="cheat-sheet-item" key={index} onClick={(e) => props.onClickExample({ refId: 'A', jqlQuery: item.jqlQuery, metric: item.metric, quantile: item.quantile, endStatus: item.endStatus } as JiraQuery)}>
                    <div className="cheat-sheet-item__title" >Click here for a {item.title} example</div>
                    <div className="cheat-sheet-item__label">{item.label}</div>
                </div>
            ))}
        </div>
    );
};
