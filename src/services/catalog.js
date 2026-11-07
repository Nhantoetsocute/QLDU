import { apiUrl } from '../config/api';

const STORE_IMAGES = {
  'nen1.png': require('../../assets/images/nen1.png'),
  'nen2.png': require('../../assets/images/nen2.png'),
  'nen3.png': require('../../assets/images/nen3.png'),
  'nen4.png': require('../../assets/images/nen4.png'),
  'nen5.png': require('../../assets/images/nen5.png'),
  'nen6.png': require('../../assets/images/nen6.png'),
};

// Convert only the public catalog fields into the existing ProductDetail item shape.
export const resolveCatalogImage = (image) => {
  if (!image) return null;
  if (typeof image !== 'string') return image;
  return /^https?:\/\//i.test(image) ? image : apiUrl(image.startsWith('/') ? image : `/${image}`);
};

export const toProductItem = (product) => ({
  ...product,
  id: String(product.id),
  productId: Number(product.id),
  price: Number(product.price),
  image: resolveCatalogImage(product.image),
  // DiscountPercent is metadata; current billing does not apply it automatically.
  tag: product.categoryName,
});

const fetchPublicData = async (path, signal) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch(apiUrl(path), { signal: controller.signal });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Không thể tải dữ liệu cửa hàng.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Kết nối quá hạn. Vui lòng kiểm tra mạng và thử lại.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
};

export const fetchCatalog = async ({ signal } = {}) => {
  const data = await fetchPublicData('/api/catalog', signal);
  return { products: data.products.map(toProductItem), categories: data.categories };
};

const statusFromPublishedHours = (hours) => {
  const match = String(hours).match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (!match) return 'Xem giờ hoạt động';
  const [hour, minute] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date()).split(':').map(Number);
  const now = hour * 60 + minute;
  const open = Number(match[1]) * 60 + Number(match[2]);
  const close = Number(match[3]) * 60 + Number(match[4]);
  const isOpen = open <= close ? now >= open && now < close : now >= open || now < close;
  return isOpen ? 'Đang mở cửa' : 'Ngoài giờ hoạt động';
};

export const fetchStores = async ({ signal } = {}) => {
  const data = await fetchPublicData('/api/stores', signal);
  return data.stores.map((store) => ({
    ...store,
    id: String(store.id),
    image: STORE_IMAGES[store.photoKey],
    status: statusFromPublishedHours(store.time),
  }));
};
