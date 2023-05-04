import {describe, expect, test} from '@jest/globals';
import * as d3 from "d3";

describe('datasource module', () => {
    test('computing quantile', () => {
        let data: any = [22, 9, 44, 36, 2, 15, 29, 16, 58, 53, 23, 93, 93, 8, 219, 31, 65, 2, 153, 100, 71]
        expect(d3.quantile(data , 0.85)).toBe(93);
    });

    it('should return true', () => {
        expect(true).toBeTruthy();
    });
});
