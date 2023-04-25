import React, {ChangeEvent} from 'react';
import {Button, InlineField, Input, SecretInput} from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions, MySecureJsonData } from '../types';
import {clearCache} from "../cache";

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  const onUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    const jsonData = {
      ...options.jsonData,
      url: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  // Secure field (only sent to the backend)
  const onTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        token: event.target.value,
      },
    });
  };

  const onResetToken = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        token: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        token: '',
      },
    });
  };

  const { jsonData, secureJsonFields } = options;
  const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

  function onCacheButtonClick1() {
    clearCache()
  }

  return (
    <div className="gf-form-group">
      <InlineField label="URL" labelWidth={12}
                   tooltip="The URL is the root URL for your Atlassian instance (example: https://jira.tarent.de)">
        <Input
          onChange={onUrlChange}
          value={jsonData.url || ''}
          placeholder="url for your jira instance"
          width={40}
        />
      </InlineField>
      <InlineField label="token" labelWidth={12} tooltip="go to your jira profil, generate a token and add the value here">
        <SecretInput
          isConfigured={(secureJsonFields && secureJsonFields.token) as boolean}
          value={secureJsonData.token || ''}
          placeholder="secure json field (backend only)"
          width={40}
          onReset={onResetToken}
          onChange={onTokenChange}
        />
      </InlineField>
      <InlineField label="cache" labelWidth={12} tooltip="to speed up requests, we are using a cache">
        <Button type="button" onClick={onCacheButtonClick1} variant="destructive">clear cache</Button>
      </InlineField>
    </div>
  );
}
