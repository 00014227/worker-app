export type TransportType = 'auto' | 'rail' | 'air' | 'sea';
export type RateStatus = 'pending' | 'responded' | 'declined' | 'winner';

export interface Contact {
  id: string;
  name: string;
  email: string;
  telegram?: string;
}

export interface Contractor {
  id: string;
  name: string;
  country: string;
  transportTypes: TransportType[];
  /** Countries/regions this contractor covers */
  routes: string[];
  contacts: Contact[];
  totalRates: number;
  rating: number; // 1-5
}

export interface RateResponse {
  id: string;
  contractorId: string;
  contractorName: string;
  amount: number;
  currency: string;
  transitDays: number;
  comment: string;
  status: RateStatus;
  respondedAt: string;
}

export interface RateRequest {
  id: string;
  token: string;
  from: string;
  to: string;
  transportType: TransportType;
  weight: number;
  volume: number;
  loadingDate: string;
  deadline: string;
  comment: string;
  status: 'open' | 'closed';
  createdAt: string;
  invitedContractors: string[];
  responses: RateResponse[];
  winnerId?: string;
}

export const CONTRACTORS: Contractor[] = [
  {
    id: 'c1',
    name: 'ТрансЛогист ООО',
    country: 'Россия',
    transportTypes: ['auto', 'rail'],
    routes: ['Россия', 'Казахстан', 'Узбекистан', 'Беларусь', 'Кыргызстан'],
    contacts: [
      {
        id: 'ct1',
        name: 'Иван Петров',
        email: 'ivan@translogist.ru',
        telegram: '@allinone_03',
      },
      { id: 'ct2', name: 'Мария Сидорова', email: 'maria@translogist.ru' },
    ],
    totalRates: 24,
    rating: 4.8,
  },
  {
    id: 'c2',
    name: 'AsiaCargo Ltd',
    country: 'Казахстан',
    transportTypes: ['auto', 'rail', 'air'],
    routes: [
      'Казахстан',
      'Узбекистан',
      'Кыргызстан',
      'Китай',
      'Россия',
      'Азербайджан',
    ],
    contacts: [
      {
        id: 'ct3',
        name: 'Алибек Дюсенов',
        email: 'alibek@asiacargo.kz',
        telegram: '@alibek_ac',
      },
    ],
    totalRates: 18,
    rating: 4.5,
  },
  {
    id: 'c3',
    name: 'SilkRoute Express',
    country: 'Узбекистан',
    transportTypes: ['auto'],
    routes: [
      'Узбекистан',
      'Казахстан',
      'Туркменистан',
      'Таджикистан',
      'Кыргызстан',
      'Афганистан',
    ],
    contacts: [
      {
        id: 'ct4',
        name: 'Санжар Юсупов',
        email: 'sanzhar@silkroute.uz',
        telegram: '@sanzhar_sr',
      },
      { id: 'ct5', name: 'Нилуфар Каримова', email: 'nilufar@silkroute.uz' },
    ],
    totalRates: 31,
    rating: 4.9,
  },
  {
    id: 'c4',
    name: 'EuroTrans GmbH',
    country: 'Германия',
    transportTypes: ['auto', 'air'],
    routes: [
      'Германия',
      'Польша',
      'Австрия',
      'Чехия',
      'Россия',
      'Казахстан',
      'Узбекистан',
    ],
    contacts: [
      {
        id: 'ct6',
        name: 'Hans Mueller',
        email: 'h.mueller@eurotrans.de',
        telegram: '@hans_et',
      },
    ],
    totalRates: 9,
    rating: 4.2,
  },
  {
    id: 'c5',
    name: 'ChinaFreight Co.',
    country: 'Китай',
    transportTypes: ['sea', 'air', 'rail'],
    routes: ['Китай', 'Россия', 'Казахстан', 'Япония', 'Корея', 'Узбекистан'],
    contacts: [
      {
        id: 'ct7',
        name: 'Li Wei',
        email: 'liwei@chinafreight.cn',
        telegram: '@liwei_cf',
      },
      { id: 'ct8', name: 'Zhang Min', email: 'zhangmin@chinafreight.cn' },
    ],
    totalRates: 42,
    rating: 4.6,
  },
  {
    id: 'c6',
    name: 'КазТранс',
    country: 'Казахстан',
    transportTypes: ['auto', 'rail'],
    routes: ['Казахстан', 'Россия', 'Китай', 'Узбекистан', 'Кыргызстан'],
    contacts: [
      {
        id: 'ct9',
        name: 'Дамир Сейткали',
        email: 'damir@kaztrans.kz',
        telegram: '@damir_kt',
      },
    ],
    totalRates: 15,
    rating: 4.3,
  },
  {
    id: 'c7',
    name: 'TurkCargo AS',
    country: 'Турция',
    transportTypes: ['auto', 'sea'],
    routes: [
      'Турция',
      'Азербайджан',
      'Грузия',
      'Казахстан',
      'Узбекистан',
      'Иран',
    ],
    contacts: [
      {
        id: 'ct10',
        name: 'Mehmet Yilmaz',
        email: 'm.yilmaz@turkcargo.com',
        telegram: '@allinone_03',
      },
    ],
    totalRates: 7,
    rating: 4.0,
  },
  {
    id: 'c8',
    name: 'АвтоДоставка РФ',
    country: 'Россия',
    transportTypes: ['auto'],
    routes: ['Россия', 'Беларусь', 'Казахстан', 'Узбекистан'],
    contacts: [
      {
        id: 'ct11',
        name: 'Сергей Волков',
        email: 'sergey@avtodostavka.ru',
        telegram: '@sergey_ad',
      },
    ],
    totalRates: 19,
    rating: 4.4,
  },
  {
    id: 'c9',
    name: 'Евгений Когай',
    country: 'Казахстан',
    transportTypes: ['auto', 'rail'],
    routes: ['Казахстан', 'Россия', 'Узбекистан', 'Китай'],
    contacts: [
      {
        id: 'ct12',
        name: 'Евгений Когай',
        email: '',
        telegram: '@EvgeniyKogay',
      },
    ],
    totalRates: 0,
    rating: 5.0,
  },
  {
    id: 'c10',
    name: 'Вячеслав',
    country: 'Казахстан',
    transportTypes: ['auto', 'rail', 'air', 'sea'],
    routes: ['Казахстан', 'Россия', 'Узбекистан', 'Китай', 'Турция'],
    contacts: [
      { id: 'ct13', name: 'Вячеслав', email: '', telegram: '@ceo_transasia' },
    ],
    totalRates: 0,
    rating: 5.0,
  },
  {
    id: 'c11',
    name: 'Анатолий',
    country: 'Казахстан',
    transportTypes: ['auto', 'rail'],
    routes: ['Казахстан', 'Россия', 'Узбекистан'],
    contacts: [
      { id: 'ct14', name: 'Анатолий', email: '', telegram: '@TaTaPuH_TAO' },
    ],
    totalRates: 0,
    rating: 5.0,
  },
];

export const RATE_REQUESTS: RateRequest[] = [
  {
    id: 'r1',
    token: 'tok-abc-123',
    from: 'Москва',
    to: 'Ташкент',
    transportType: 'auto',
    weight: 5000,
    volume: 20,
    loadingDate: '2026-04-20',
    deadline: '2026-04-18',
    comment: 'Срочная доставка, нужна рефрижераторная машина',
    status: 'open',
    createdAt: '2026-04-14',
    invitedContractors: ['c1', 'c3', 'c8'],
    responses: [
      {
        id: 'resp1',
        contractorId: 'c1',
        contractorName: 'ТрансЛогист ООО',
        amount: 1800,
        currency: 'USD',
        transitDays: 5,
        comment: 'Готовы выполнить, машина свободна',
        status: 'responded',
        respondedAt: '2026-04-14T14:30:00Z',
      },
      {
        id: 'resp2',
        contractorId: 'c3',
        contractorName: 'SilkRoute Express',
        amount: 1650,
        currency: 'USD',
        transitDays: 6,
        comment: 'Можем немного сократить цену при оплате заранее',
        status: 'responded',
        respondedAt: '2026-04-14T16:00:00Z',
      },
    ],
  },
  {
    id: 'r2',
    token: 'tok-def-456',
    from: 'Шанхай',
    to: 'Москва',
    transportType: 'rail',
    weight: 12000,
    volume: 40,
    loadingDate: '2026-04-25',
    deadline: '2026-04-20',
    comment: 'Контейнер 40HC',
    status: 'open',
    createdAt: '2026-04-13',
    invitedContractors: ['c2', 'c5', 'c6'],
    responses: [
      {
        id: 'resp3',
        contractorId: 'c5',
        contractorName: 'ChinaFreight Co.',
        amount: 4200,
        currency: 'USD',
        transitDays: 18,
        comment: 'Прямой маршрут через Казахстан',
        status: 'winner',
        respondedAt: '2026-04-13T10:00:00Z',
      },
    ],
    winnerId: 'resp3',
  },
  {
    id: 'r3',
    token: 'tok-ghi-789',
    from: 'Стамбул',
    to: 'Алматы',
    transportType: 'auto',
    weight: 3000,
    volume: 15,
    loadingDate: '2026-05-01',
    deadline: '2026-04-25',
    comment: '',
    status: 'open',
    createdAt: '2026-04-15',
    invitedContractors: ['c4', 'c7'],
    responses: [],
  },
];

export type ShipmentStatus =
  | 'new'
  | 'pending_rates'
  | 'carrier_assigned'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface Shipment {
  id: string;
  orderNumber: string;
  client: string;
  fromCity: string;
  fromIndex?: string;
  fromCountry: string;
  toCity: string;
  toIndex?: string;
  toCountry: string;
  loadingDate: string;
  weightKg: number;
  cargoValueUsd?: number;
  cargoType: string;
  vehicleType: string;
  vehicleCount: number;
  loadingMethod?: string;
  hsCodes?: string[];
  exportCustoms?: string;
  importCustoms?: string;
  incoterms?: string;
  currency: string;
  specialConditions?: string;
  comment?: string;
  status: ShipmentStatus;
  createdAt: string;
  rateRequestId?: string;
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  new: 'Новая',
  pending_rates: 'Ожидает ставок',
  carrier_assigned: 'Перевозчик назначен',
  in_transit: 'В пути',
  delivered: 'Доставлено',
  cancelled: 'Отменено',
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  pending_rates: 'bg-yellow-100 text-yellow-800',
  carrier_assigned: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const SHIPMENTS: Shipment[] = [
  {
    id: 's1',
    orderNumber: 'ORD-2026-041',
    client: 'НТО Консалт',
    fromCity: 'Ташкент',
    fromCountry: 'Узбекистан',
    fromIndex: '100015',
    toCity: 'Москва',
    toCountry: 'Россия',
    toIndex: '115114',
    loadingDate: '2026-04-25',
    weightKg: 8500,
    cargoValueUsd: 45000,
    cargoType: 'general',
    vehicleType: 'truck',
    vehicleCount: 1,
    loadingMethod: 'rear',
    hsCodes: ['8471 - Машины вычислительные'],
    incoterms: 'DAP',
    currency: 'USD',
    comment: 'Хрупкий груз, требуется аккуратная погрузка',
    status: 'new',
    createdAt: '2026-04-18',
  },
  {
    id: 's2',
    orderNumber: 'ORD-2026-042',
    client: 'ARS Transport',
    fromCity: 'Алматы',
    fromCountry: 'Казахстан',
    toCity: 'Стамбул',
    toCountry: 'Турция',
    loadingDate: '2026-04-28',
    weightKg: 15000,
    cargoValueUsd: 72000,
    cargoType: 'general',
    vehicleType: 'truck_mega',
    vehicleCount: 2,
    loadingMethod: 'side',
    incoterms: 'FCA',
    currency: 'USD',
    status: 'pending_rates',
    createdAt: '2026-04-17',
    rateRequestId: 'r1',
  },
  {
    id: 's3',
    orderNumber: 'ORD-2026-039',
    client: 'Спортмастер',
    fromCity: 'Шанхай',
    fromCountry: 'Китай',
    toCity: 'Ташкент',
    toCountry: 'Узбекистан',
    loadingDate: '2026-05-05',
    weightKg: 22000,
    cargoValueUsd: 180000,
    cargoType: 'general',
    vehicleType: 'container_40',
    vehicleCount: 1,
    hsCodes: ['6403 - Обувь', '9403 - Мебель прочая'],
    incoterms: 'CIF',
    currency: 'USD',
    exportCustoms: 'Шанхай, порт Янгшань',
    importCustoms: 'Ташкент, СВХ Сергели',
    status: 'carrier_assigned',
    createdAt: '2026-04-10',
    rateRequestId: 'r2',
  },
  {
    id: 's4',
    orderNumber: 'ORD-2026-038',
    client: 'НТО Консалт',
    fromCity: 'Берлин',
    fromCountry: 'Германия',
    toCity: 'Ташкент',
    toCountry: 'Узбекистан',
    loadingDate: '2026-05-10',
    weightKg: 4200,
    cargoType: 'general',
    vehicleType: 'truck',
    vehicleCount: 1,
    currency: 'EUR',
    status: 'new',
    createdAt: '2026-04-16',
  },
  {
    id: 's5',
    orderNumber: 'ORD-2026-035',
    client: 'ARS Transport',
    fromCity: 'Ташкент',
    fromCountry: 'Узбекистан',
    toCity: 'Дубай',
    toCountry: 'ОАЭ',
    loadingDate: '2026-04-15',
    weightKg: 3000,
    cargoValueUsd: 25000,
    cargoType: 'refrigerated',
    vehicleType: 'ref',
    vehicleCount: 1,
    incoterms: 'DAP',
    currency: 'USD',
    specialConditions: 'Температура +2..+8°C',
    status: 'in_transit',
    createdAt: '2026-04-08',
  },
];

export const TRANSPORT_LABELS: Record<TransportType, string> = {
  auto: 'Авто',
  rail: 'Ж/Д',
  air: 'Авиа',
  sea: 'Море',
};

export const COUNTRY_LIST = [
  'Россия',
  'Казахстан',
  'Узбекистан',
  'Германия',
  'Китай',
  'Турция',
  'Беларусь',
  'Кыргызстан',
  'Азербайджан',
  'Грузия',
  'Таджикистан',
  'Туркменистан',
  'Иран',
  'Польша',
  'Австрия',
  'Чехия',
];
