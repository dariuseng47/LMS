import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function fetchFabricItems(params) {
  const { data } = await apiClient.get(endpoints.fabricItems.list, { params });
  return data; // { fabricItems }
}

export async function fetchFabricItemByEpc(epc) {
  const { data } = await apiClient.get(endpoints.fabricItems.details(epc));
  return data; // { fabricItem, scanHistory }
}

export async function holdFabricItem(id, { reasonCode }) {
  const { data } = await apiClient.post(endpoints.fabricItems.hold(id), { reasonCode });
  return data;
}

export async function decommissionFabricItem(id, { reasonCode }) {
  const { data } = await apiClient.post(endpoints.fabricItems.decommission(id), { reasonCode });
  return data;
}
