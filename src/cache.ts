import localforage from "localforage";
import {getBackendSrv} from "@grafana/runtime";

const cacheStore = localforage.createInstance({
    name: 'TarentJiraDatasourceRequests'
});
// 1 hour in ms
export const cacheTTL = 60 * 60 * 1000

export type CachedItem = {
    value: any,
    expiry: number
};

export async function clearCache() {
    return cacheStore.clear()
}

export async function doCachedRequest<T>(url: string, params?: any): Promise<T> {
    let urlWithParams = url + "?" + new URLSearchParams(params).toString()
    // Try to retrieve the data from the cache
    const cachedData = await cacheStore.getItem(urlWithParams) as CachedItem;

    if (cachedData != null) {
        const now = new Date()
        if (now.getTime() <= cachedData.expiry + cacheTTL) {
            return Promise.resolve(cachedData.value as T);
        } else {
            await cacheStore.removeItem(urlWithParams)
        }
    }

    let response = await getBackendSrv().get<T>(url, {...params})
    const now = new Date()
    // `item` is an object which contains the original value
    // as well as the time when it's supposed to expire
    const item: CachedItem = {
        value: response,
        expiry: now.getTime() + cacheTTL,
    }
    // Store the data in the cache for future use
    await cacheStore.setItem(urlWithParams, item);
    return response
}
