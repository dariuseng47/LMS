import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function wardIssueScan(payload) {
  const { data } = await apiClient.post(endpoints.operations.wardIssue, payload);
  return data;
}

export async function wardReceiveScan(payload) {
  const { data } = await apiClient.post(endpoints.operations.wardReceive, payload);
  return data;
}

export async function fetchLocationByEpc(epc) {
  const { data } = await apiClient.get(endpoints.operations.location(epc));
  return data;
}
