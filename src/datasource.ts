import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { MyQuery, MyDataSourceOptions } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    // Return a constant for each query.
    const data = options.targets.map((target) => {
      const frame = new MutableDataFrame({
        refId: target.refId,
        fields: [
          { name: 'IssueKey', type: FieldType.string },
          { name: 'IssueType', type: FieldType.string },
          { name: 'Created', type: FieldType.time },
          { name: 'field', type: FieldType.string },
          { name: 'fromValue', type: FieldType.string },
          { name: 'toValue',  type: FieldType.string },
        ],
      });

      const issueKeys = ['MCP-2508','MCP-2510','MCP-2507','MCP-2509']
      const issueTypes = ['story', 'bug']
      const status = ['Open', 'New', 'Closed']

      for (let i = 0; i < 100 ; i++) {
        frame.appendRow([
            issueKeys[Math.floor(Math.random() * issueKeys.length)],
            issueTypes[Math.floor(Math.random() * issueTypes.length)],
            new Date(),
            'status',
             status[Math.floor(Math.random() * status.length)],
             status[Math.floor(Math.random() * status.length)],

        ]);
      }

      return frame;
    });



    return { data };
  }

  async testDatasource() {
    //TODO: Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
