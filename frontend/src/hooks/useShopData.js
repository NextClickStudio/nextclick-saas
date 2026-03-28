import { useState, useEffect } from 'react';
import axios from 'axios';

const params = new URLSearchParams(window.location.search);
const SHOP = params.get('shop');

const api = axios.create({
  baseURL: '/api',
  params: { shop: SHOP },
  withCredentials: true,
});

export function useShopData() {
  const [shop, setShop] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/shop');
      setShop(data.shop);
      setConfig(data.shop?.config);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  return { shop, config, loading, error, reload, api };
}

export { api };
