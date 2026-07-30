import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Send as SendIcon,
  Check,
  Loader2,
  RotateCcw,
  Wand2,
  BarChart3,
  Download,
  X,
} from "lucide-react";
import { matchSuppliers } from "../lib/contractor-matcher";
import {
  tenderApi,
  SupplierRow,
  TenderMode,
  TENDER_MODE_LABELS,
  CreateTenderInput,
  CONTACT_CHANNEL_LABELS,
  CARGO_TYPES,
  CargoType,
  VEHICLE_TYPES,
  REF_VEHICLE_TYPE,
  LOADING_METHODS,
  INCOTERMS,
  RouteBenchmark,
  BitrixDealRow,
  DealPrefill,
} from "../lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MODES: TenderMode[] = ["auto", "rail", "air", "sea"];
const CURRENCIES = ["USD", "EUR", "RUB", "UZS", "KZT", "CNY"];
/** Repeat calculations should not start from scratch — remember the last input. */
const DRAFT_KEY = "transasia.tender.draft";

type FormState = Omit<
  CreateTenderInput,
  "weightKg" | "vehicleCount" | "cargoValue" | "selfCost" | "supplierIds"
> & {
  weightKg: string;
  vehicleCount: string;
  cargoValue: string;
  selfCost: string;
  /** Значение <input type="datetime-local"> — местное время без зоны. */
  bidDeadline: string;
};

const emptyForm: FormState = {
  origin: "",
  originIndex: "",
  originCountry: "",
  destination: "",
  destinationIndex: "",
  destinationCountry: "",
  loadingDate: "",
  cargoType: "генеральный",
  hazardClass: "",
  temperatureRegime: "",
  vehicleCount: "1",
  vehicleType: "",
  hsCodes: "",
  loadingMethod: "",
  weightKg: "",
  exportCustoms: "",
  importCustoms: "",
  incoterms: "",
  cargoValue: "",
  bidDeadline: "",
  conditions: "",
  comment: "",
  mode: undefined,
  cargo: "",
  currency: "USD",
  selfCost: "",
};

const selectCls =
  "w-full h-8 rounded-md border border-border bg-background px-2 text-sm outline-none";

export default function NewRateRequestPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      // Loading date is intentionally not restored — it's almost always different.
      // Dates are deliberately not restored — they're almost always different,
      // and a stale one would silently go out to contractors.
      if (saved)
        return {
          ...emptyForm,
          ...JSON.parse(saved),
          loadingDate: "",
          bidDeadline: "",
        };
    } catch {
      /* corrupted draft — start clean */
    }
    return emptyForm;
  });
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Кого менеджер снял вручную — автоподбор их больше не возвращает. */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  /** Кого отметил именно автоподбор — только их он вправе снимать при смене маршрута. */
  const autoPicked = useRef<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  /** Шаг 1 — параметры запроса, шаг 2 — подбор подрядчиков. */
  const [step, setStep] = useState<"form" | "suppliers">("form");
  /** Рыночный ориентир по маршруту — грузится при переходе на шаг подбора. */
  const [benchmark, setBenchmark] = useState<RouteBenchmark | null>(null);
  /** Модалка выбора сделки Битрикса и её содержимое. */
  const [dealsOpen, setDealsOpen] = useState(false);
  const [deals, setDeals] = useState<BitrixDealRow[] | null>(null);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [dealSearch, setDealSearch] = useState("");
  const [prefilling, setPrefilling] = useState<number | null>(null);
  /** Из какой сделки заполнена форма (бейдж + список незаполненного). */
  const [prefilledFrom, setPrefilledFrom] = useState<DealPrefill | null>(null);

  useEffect(() => {
    tenderApi.suppliers
      .list()
      .then(setSuppliers)
      .catch((e) => setError((e as Error).message));
  }, []);

  // Persist the draft so a repeat request starts from the previous one.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* quota */
    }
  }, [form]);

  const isTemp = form.cargoType === "температурный";
  const isHazard = form.cargoType === "опасный";
  // Temperature cargo travels only in a reefer.
  const vehicleOptions = isTemp ? [REF_VEHICLE_TYPE] : [...VEHICLE_TYPES];

  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  /**
   * Подставляет страну по городу из справочника пунктов — без неё автоподбор
   * по направлению просто не с чем сопоставлять. Уже введённую страну не трогаем.
   */
  const fillCountry = async (
    city: string,
    field: "originCountry" | "destinationCountry",
  ) => {
    if (!city.trim()) return;
    const current =
      field === "originCountry" ? form.originCountry : form.destinationCountry;
    if (current?.trim()) return;
    try {
      const { country } = await tenderApi.suppliers.resolveCountry(city);
      if (country)
        setForm((f) => (f[field]?.trim() ? f : { ...f, [field]: country }));
    } catch {
      /* справочник недоступен — менеджер введёт страну руками */
    }
  };

  const setCargoType = (cargoType: CargoType) => {
    setForm((f) => ({
      ...f,
      cargoType,
      // Keep the body type consistent with the cargo, and drop values that no
      // longer apply so they can't be submitted invisibly.
      vehicleType:
        cargoType === "температурный"
          ? REF_VEHICLE_TYPE
          : f.vehicleType === REF_VEHICLE_TYPE
            ? ""
            : f.vehicleType,
      hazardClass: cargoType === "опасный" ? f.hazardClass : "",
      temperatureRegime:
        cargoType === "температурный" ? f.temperatureRegime : "",
    }));
  };

  // Подбор по маршруту: пересчитывается на лету, подходящие идут первыми.
  const matched = useMemo(
    () =>
      matchSuppliers(
        {
          originCountry: form.originCountry,
          destinationCountry: form.destinationCountry,
          mode: form.mode,
        },
        suppliers,
      ),
    [suppliers, form.originCountry, form.destinationCountry, form.mode],
  );

  const fullMatchIds = useMemo(
    () =>
      matched.filter((m) => m.matchType === "full").map((m) => m.supplier.id),
    [matched],
  );

  // Автоотметка: ставим галочки на полных совпадениях, но не трогаем то, что
  // менеджер выбрал сам, и не возвращаем снятых вручную.
  useEffect(() => {
    const full = new Set(fullMatchIds.filter((id) => !dismissed.has(id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of autoPicked.current) if (!full.has(id)) next.delete(id);
      for (const id of full) next.add(id);
      return next;
    });
    autoPicked.current = full;
  }, [fullMatchIds, dismissed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matched;
    return matched.filter(
      (m) =>
        m.supplier.name.toLowerCase().includes(q) ||
        (m.supplier.telegramUsername ?? "").toLowerCase().includes(q),
    );
  }, [matched, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Ручное снятие запоминаем, иначе следующий пересчёт вернёт галочку обратно.
    setDismissed((prev) => {
      const next = new Set(prev);
      if (selected.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /** Свои сделки первыми, затем остальные; поиск по названию и номеру. */
  const visibleDeals = useMemo(() => {
    const list = deals ?? [];
    const q = dealSearch.trim().toLowerCase();
    const found = q
      ? list.filter(
          (d) => d.title.toLowerCase().includes(q) || String(d.id).includes(q),
        )
      : list;
    return [...found].sort((a, b) => Number(b.mine) - Number(a.mine));
  }, [deals, dealSearch]);

  const openDeals = async () => {
    setDealsOpen(true);
    setDealsError(null);
    setDeals(null);
    try {
      setDeals(await tenderApi.tenders.bitrixDeals());
    } catch (e) {
      setDealsError((e as Error).message);
      setDeals([]);
    }
  };

  /**
   * Переносит поля сделки в форму. Заполняем только то, что пришло: пустые
   * значения не затирают уже введённое руками, иначе выбор сделки мог бы стереть
   * работу логиста.
   */
  const applyDeal = async (dealId: number) => {
    setPrefilling(dealId);
    setDealsError(null);
    try {
      const p = await tenderApi.tenders.dealPrefill(dealId);
      setForm((f) => ({
        ...f,
        origin: p.origin ?? f.origin,
        destination: p.destination ?? f.destination,
        originCountry: p.originCountry ?? f.originCountry,
        destinationCountry: p.destinationCountry ?? f.destinationCountry,
        cargo: p.cargo ?? f.cargo,
        cargoType: (p.cargoType as CargoType) ?? f.cargoType,
        temperatureRegime: p.temperatureRegime ?? f.temperatureRegime,
        // Температурный груз возит только реф — держим кузов согласованным.
        vehicleType:
          p.cargoType === "температурный" ? REF_VEHICLE_TYPE : f.vehicleType,
        weightKg: p.weightKg != null ? String(p.weightKg) : f.weightKg,
        hsCodes: p.hsCodes ?? f.hsCodes,
        vehicleCount:
          p.vehicleCount != null ? String(p.vehicleCount) : f.vehicleCount,
        incoterms: p.incoterms ?? f.incoterms,
        cargoValue: p.cargoValue != null ? String(p.cargoValue) : f.cargoValue,
        currency: p.currency ?? f.currency,
        mode: p.mode ?? f.mode,
        loadingDate: p.loadingDate ?? f.loadingDate,
        comment: p.comment ?? f.comment,
      }));
      setPrefilledFrom(p);
      setDealsOpen(false);
    } catch (e) {
      setDealsError((e as Error).message);
    } finally {
      setPrefilling(null);
    }
  };

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!form.origin.trim()) m.push("Город отправления");
    if (!form.destination.trim()) m.push("Город назначения");
    if (!form.cargo?.trim()) m.push("Наименование груза");
    if (isHazard && !form.hazardClass?.trim()) m.push("Класс опасности");
    if (isTemp && !form.temperatureRegime?.trim())
      m.push("Температурный режим");
    if (!form.vehicleCount || Number(form.vehicleCount) < 1)
      m.push("Количество ТС");
    if (!form.vehicleType) m.push("Вид транспорта");
    if (!form.weightKg || Number(form.weightKg) <= 0) m.push("Масса брутто");
    return m;
  }, [form, isHazard, isTemp]);

  /** Переход ко второму шагу — только на заполненной форме. */
  const goToSuppliers = () => {
    setTouched(true);
    if (missing.length) {
      setError(`Заполните обязательные поля: ${missing.join(", ")}`);
      return;
    }
    setError(null);
    setStep("suppliers");
    // Ориентир по маршруту нужен именно здесь — перед рассылкой. Ошибку глотаем:
    // отсутствие истории не должно мешать выбрать подрядчиков.
    tenderApi.tenders
      .benchmark({
        origin: form.origin,
        destination: form.destination,
        originCountry: form.originCountry,
        destinationCountry: form.destinationCountry,
        currency: form.currency,
      })
      .then(setBenchmark)
      .catch(() => setBenchmark(null));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToForm = () => {
    setError(null);
    setStep("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setTouched(true);
    if (missing.length) {
      // Поля правятся на первом шаге — возвращаем туда, иначе ошибку негде исправить.
      setError(`Заполните обязательные поля: ${missing.join(", ")}`);
      setStep("form");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateTenderInput = {
        ...form,
        weightKg: Number(form.weightKg),
        vehicleCount: Number(form.vehicleCount),
        cargoValue: form.cargoValue ? Number(form.cargoValue) : undefined,
        // Пустая строка из поля «Ставка» не пройдёт валидацию числа на бэке.
        selfCost: form.selfCost ? Number(form.selfCost) : undefined,
        bitrixDealId: prefilledFrom?.dealId,
        // datetime-local has no timezone: parse it as the manager's local time and
        // send a real instant, otherwise the server (UTC) would shift it by hours.
        bidDeadline: form.bidDeadline
          ? new Date(form.bidDeadline).toISOString()
          : undefined,
        loadingMethod: form.loadingMethod || undefined,
        supplierIds: selected.size ? [...selected] : undefined,
      };
      const tender = await tenderApi.tenders.create(payload);
      navigate(`/rate-requests/${tender.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const req = (label: string) => (
    <>
      {label} <span className="text-red-500">*</span>
    </>
  );
  const invalid = (v: string | undefined) => touched && !v?.trim();

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/rate-requests")}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <ArrowLeft size={13} /> К запросам
        </button>
        <button
          onClick={() => {
            setForm(emptyForm);
            setSelected(new Set());
            setDismissed(new Set());
            autoPicked.current = new Set();
            setTouched(false);
            setStep("form");
          }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <RotateCcw size={12} /> Очистить форму
        </button>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold">Новый запрос ставок</h1>
        {/* Индикатор этапов */}
        <div className="flex items-center gap-2 text-xs">
          {(["form", "suppliers"] as const).map((s, i) => {
            const active = step === s;
            const done = step === "suppliers" && s === "form";
            return (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <span
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : done
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-border text-muted-foreground",
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                    {done ? <Check size={10} /> : i + 1}
                  </span>
                  {s === "form" ? "Параметры запроса" : "Подрядчики"}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === "form" && (
        <>
          {/* Автозаполнение из сделки: логисту не нужно перебивать руками то,
              что уже заведено в Битриксе. */}
          <Card size="sm">
            <CardContent className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {prefilledFrom ? (
                  <>
                    Заполнено из сделки{" "}
                    <span className="font-medium text-foreground">
                      #{prefilledFrom.dealId} {prefilledFrom.dealTitle}
                    </span>
                    {prefilledFrom.unmapped.length > 0 && (
                      <span className="text-amber-700 block mt-0.5">
                        Заполните вручную: {prefilledFrom.unmapped.join(", ")}
                      </span>
                    )}
                  </>
                ) : (
                  "Можно заполнить поля из сделки Битрикса на этапе «Расчет ставки»"
                )}
              </div>
              <button
                type="button"
                onClick={openDeals}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition-colors"
              >
                <Download size={13} />
                {prefilledFrom ? "Выбрать другую сделку" : "Заполнить из сделки"}
              </button>
            </CardContent>
          </Card>

          {/* ── Маршрут ── */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm">Маршрут</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{req("Город отправления")}</Label>
                  <Input
                    value={form.origin}
                    onChange={(e) => set({ origin: e.target.value })}
                    placeholder="Москва"
                    onBlur={(e) => fillCountry(e.target.value, "originCountry")}
                    className={cn(invalid(form.origin) && "border-red-400")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Индекс</Label>
                  <Input
                    value={form.originIndex ?? ""}
                    onChange={(e) => set({ originIndex: e.target.value })}
                    placeholder="101000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Страна</Label>
                  <Input
                    value={form.originCountry ?? ""}
                    onChange={(e) => set({ originCountry: e.target.value })}
                    placeholder="Россия"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{req("Город назначения")}</Label>
                  <Input
                    value={form.destination}
                    onChange={(e) => set({ destination: e.target.value })}
                    placeholder="Ташкент"
                    onBlur={(e) =>
                      fillCountry(e.target.value, "destinationCountry")
                    }
                    className={cn(
                      invalid(form.destination) && "border-red-400",
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Индекс</Label>
                  <Input
                    value={form.destinationIndex ?? ""}
                    onChange={(e) => set({ destinationIndex: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Страна</Label>
                  <Input
                    value={form.destinationCountry ?? ""}
                    onChange={(e) =>
                      set({ destinationCountry: e.target.value })
                    }
                    placeholder="Узбекистан"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Груз ── */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm">Груз</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Дата погрузки</Label>
                  <Input
                    type="date"
                    value={form.loadingDate}
                    onChange={(e) => set({ loadingDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{req("Масса брутто, кг")}</Label>
                  <Input
                    type="number"
                    value={form.weightKg}
                    onChange={(e) => set({ weightKg: e.target.value })}
                    placeholder="5000"
                    className={cn(
                      touched &&
                        (!form.weightKg || Number(form.weightKg) <= 0) &&
                        "border-red-400",
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{req("Наименование груза")}</Label>
                  <Input
                    value={form.cargo ?? ""}
                    onChange={(e) => set({ cargo: e.target.value })}
                    placeholder="Оборудование"
                    className={cn(invalid(form.cargo) && "border-red-400")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Тип груза</Label>
                <div className="flex gap-2 flex-wrap">
                  {CARGO_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCargoType(t)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize",
                        form.cargoType === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Условные поля */}
              {isHazard && (
                <div className="space-y-1.5">
                  <Label>{req("Класс опасности")}</Label>
                  <Input
                    value={form.hazardClass ?? ""}
                    onChange={(e) => set({ hazardClass: e.target.value })}
                    placeholder="напр. 3 (легковоспламеняющиеся жидкости)"
                    className={cn(
                      invalid(form.hazardClass) && "border-red-400",
                    )}
                  />
                </div>
              )}
              {isTemp && (
                <div className="space-y-1.5">
                  <Label>{req("Температурный режим")}</Label>
                  <Input
                    value={form.temperatureRegime ?? ""}
                    onChange={(e) => set({ temperatureRegime: e.target.value })}
                    placeholder="напр. +2…+8 °C"
                    className={cn(
                      invalid(form.temperatureRegime) && "border-red-400",
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Код ТНВЭД</Label>
                  <Input
                    value={form.hsCodes}
                    onChange={(e) => set({ hsCodes: e.target.value })}
                    placeholder="8471, 8473"
                  />
                  <p className="text-xs text-muted-foreground">
                    Несколько кодов — через запятую.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Стоимость груза</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={form.cargoValue}
                      onChange={(e) => set({ cargoValue: e.target.value })}
                      placeholder="45000"
                    />
                    <select
                      value={form.currency ?? ""}
                      onChange={(e) => set({ currency: e.target.value })}
                      className={cn(selectCls, "w-24")}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Транспорт ── */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm">Транспорт</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{req("Количество ТС")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.vehicleCount}
                    onChange={(e) => set({ vehicleCount: e.target.value })}
                    className={cn(
                      touched &&
                        Number(form.vehicleCount) < 1 &&
                        "border-red-400",
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{req("Вид транспорта")}</Label>
                  <select
                    value={form.vehicleType}
                    onChange={(e) => set({ vehicleType: e.target.value })}
                    className={cn(
                      selectCls,
                      invalid(form.vehicleType) && "border-red-400",
                    )}
                  >
                    <option value="">— выберите —</option>
                    {vehicleOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {isTemp && (
                    <p className="text-xs text-muted-foreground">
                      Для температурного груза доступен только REF.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Способ погрузки</Label>
                  <select
                    value={form.loadingMethod ?? ""}
                    onChange={(e) => set({ loadingMethod: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">— не указан —</option>
                    {LOADING_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Тип перевозки</Label>
                <div className="flex gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        set({ mode: form.mode === m ? undefined : m })
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        form.mode === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {TENDER_MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Таможня и условия ── */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm">Таможня и условия</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Экспортное оформление</Label>
                  <Input
                    value={form.exportCustoms}
                    onChange={(e) => set({ exportCustoms: e.target.value })}
                    placeholder="Москва, СВХ"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Импортное оформление</Label>
                  <Input
                    value={form.importCustoms}
                    onChange={(e) => set({ importCustoms: e.target.value })}
                    placeholder="Ташкент, СВХ Сергели"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Инкотермс</Label>
                  <select
                    value={form.incoterms}
                    onChange={(e) => set({ incoterms: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">— выберите —</option>
                    {INCOTERMS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Дедлайн подачи ставки</Label>
                  <Input
                    type="datetime-local"
                    value={form.bidDeadline}
                    onChange={(e) => set({ bidDeadline: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    До какого момента ждём ставку от подрядчика.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Особые условия</Label>
                  <Input
                    value={form.conditions ?? ""}
                    onChange={(e) => set({ conditions: e.target.value })}
                    placeholder="Груз на палетах, растентовка…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Комментарий</Label>
                  <Input
                    value={form.comment ?? ""}
                    onChange={(e) => set({ comment: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ставка, указывается в $</Label>
                  <Input
                    value={form.selfCost ?? ""}
                    onChange={(e) =>
                      set({ selfCost: e.target.value.replace("-", "") })
                    }
                    placeholder="1000"
                    type="number"
                    min={0}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Переход к шагу 2 */}
          <div className="flex items-center gap-3 flex-wrap pb-6">
            <button
              onClick={goToSuppliers}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Далее — подрядчики <ArrowRight size={15} />
            </button>
            <span className="text-xs text-muted-foreground">
              {touched && missing.length > 0
                ? `Не заполнено: ${missing.join(", ")}`
                : "Подрядчики подберутся автоматически по направлению."}
            </span>
          </div>
        </>
      )}

      {/* ── Шаг 2: подрядчики ── */}
      {step === "suppliers" && (
        <>
          {/* Сводка запроса — чтобы менеджер видел, под что подбирает */}
          <Card size="sm">
            <CardContent className="flex items-start justify-between gap-4 flex-wrap">
              <div className="text-sm">
                <div className="font-semibold">
                  {form.origin} → {form.destination}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[
                    form.originCountry && form.destinationCountry
                      ? `${form.originCountry} → ${form.destinationCountry}`
                      : null,
                    // Дата из <input type=date> — «2026-08-01», парсится как UTC-полночь.
                    // Без timeZone:'UTC' в западных зонах показывался бы предыдущий день.
                    form.loadingDate
                      ? new Date(form.loadingDate).toLocaleDateString("ru-RU", {
                          timeZone: "UTC",
                        })
                      : null,
                    form.cargoType,
                    form.weightKg
                      ? `${Number(form.weightKg).toLocaleString("ru-RU")} кг`
                      : null,
                    form.vehicleType
                      ? `${form.vehicleType} × ${form.vehicleCount}`
                      : null,
                    form.incoterms,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                onClick={backToForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition-colors"
              >
                <ArrowLeft size={13} /> Изменить параметры
              </button>
              {/* Рыночный ориентир до рассылки: видно, адекватна ли будущая ставка. */}
              {benchmark && (
                <div className="w-full pt-2 border-t flex items-start gap-1.5 text-xs">
                  <BarChart3 size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                  {benchmark.level !== "global" && benchmark.medianPurchase != null ? (
                    <p className="text-muted-foreground">
                      Ориентир
                      {benchmark.level === "country"
                        ? ` по направлению ${benchmark.scope}`
                        : " по маршруту"}
                      :{" "}
                      <span className="font-medium text-foreground">
                        {Number(benchmark.medianPurchase).toLocaleString("ru-RU")}{" "}
                        {benchmark.currency}
                      </span>
                      {benchmark.minBid != null && benchmark.maxBid != null && (
                        <>
                          {" "}· ставки {Number(benchmark.minBid).toLocaleString("ru-RU")}–
                          {Number(benchmark.maxBid).toLocaleString("ru-RU")}
                        </>
                      )}
                      {" · "}
                      <span className={cn(!benchmark.reliable && "text-amber-700")}>
                        {benchmark.reliable
                          ? `по ${benchmark.purchases} закупкам`
                          : `мало данных: ${benchmark.purchases} закупк${benchmark.purchases === 1 ? "а" : "и"}`}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      По этому маршруту истории закупок пока нет — сравнивать ставки будет не с чем.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm">
                Подрядчики{" "}
                {selected.size > 0 && (
                  <span className="text-primary font-normal">
                    · выбрано {selected.size}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 space-y-3">
              {/* Итог автоподбора — видно, сработал он или маршрут ещё не задан */}
              {(form.originCountry?.trim() ||
                form.destinationCountry?.trim()) && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Wand2 size={12} className="text-primary" />
                    {fullMatchIds.length > 0 ? (
                      <>
                        Подобрано{" "}
                        <b className="text-foreground">{fullMatchIds.length}</b>{" "}
                        по направлению {form.originCountry || "?"} →{" "}
                        {form.destinationCountry || "?"}
                      </>
                    ) : (
                      <>
                        По направлению {form.originCountry || "?"} →{" "}
                        {form.destinationCountry || "?"} совпадений нет —
                        отметьте вручную
                      </>
                    )}
                  </span>
                  {dismissed.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissed(new Set())}
                      className="text-primary hover:underline"
                    >
                      Вернуть снятых ({dismissed.size})
                    </button>
                  )}
                </div>
              )}

              <div className="relative w-full sm:w-64">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Поиск…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Подрядчики не найдены
                  </div>
                ) : (
                  filtered.map(({ supplier: s, matchType, reasons }) => {
                    const on = selected.has(s.id);
                    const tgOk = !!(s.telegramUsername || s.telegramBound);
                    const emailOk = !!s.email;
                    const unreachable =
                      (s.contactChannel === "telegram" && !tgOk) ||
                      (s.contactChannel === "email" && !emailOk) ||
                      (s.contactChannel === "both" && !tgOk && !emailOk);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(s.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                          on ? "bg-primary/5" : "hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                            on
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {on && <Check size={11} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-sm font-medium block truncate">
                            {s.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {CONTACT_CHANNEL_LABELS[s.contactChannel]}
                            {s.telegramUsername &&
                              ` · @${s.telegramUsername.replace("@", "")}`}
                            {s.email && ` · ${s.email}`}
                          </span>
                          {/* Надёжность и история — чтобы звать не только «по направлению». */}
                          {s.scorecard && (s.scorecard.reliability != null || s.scorecard.invites > 0) && (
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {s.scorecard.reliability != null
                                ? `надёжность ${s.scorecard.reliability}`
                                : "не проверен"}
                              {s.scorecard.wins > 0 && ` · перевозок ${s.scorecard.wins}`}
                              {s.scorecard.breaks > 0 && (
                                <span className="text-red-600"> · срывов {s.scorecard.breaks}</span>
                              )}
                              {s.scorecard.avgResponseMin != null &&
                                ` · отвечает ~${
                                  s.scorecard.avgResponseMin < 60
                                    ? `${s.scorecard.avgResponseMin} мин`
                                    : `${Math.round(s.scorecard.avgResponseMin / 60)} ч`
                                }`}
                            </span>
                          )}
                        </span>
                        {/* Почему подрядчик подобран (или почему нет) */}
                        {matchType === "full" && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                            по направлению
                          </span>
                        )}
                        {matchType === "none" && (
                          <span
                            className="shrink-0 text-[10px] text-muted-foreground"
                            title={reasons[0]}
                          >
                            {reasons[0]}
                          </span>
                        )}
                        {unreachable && (
                          <span className="text-xs text-amber-600 shrink-0">
                            нет контакта
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap pb-6">
            <button
              onClick={backToForm}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft size={15} /> Назад
            </button>
            <button
              disabled={saving}
              onClick={submit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <SendIcon size={15} />
              )}
              Создать запрос
            </button>
            <span className="text-xs text-muted-foreground">
              {selected.size > 0
                ? `Выбрано подрядчиков: ${selected.size}. Отправка — на следующем экране.`
                : "Можно создать и без подрядчиков — добавите позже."}
            </span>
          </div>
        </>
      )}

      {/* Выбор сделки Битрикса: свои сверху — логист обычно берёт собственную,
          но должен видеть и остальные, чтобы подхватить работу коллеги. */}
      {dealsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16 px-4"
          onClick={() => setDealsOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[70vh] flex flex-col bg-background rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="font-semibold text-sm">Сделки на этапе «Расчет ставки»</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Из воронки вашего офиса
                </p>
              </div>
              <button
                onClick={() => setDealsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Поиск по названию или номеру…"
                  value={dealSearch}
                  onChange={(e) => setDealSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {dealsError && (
                <div className="p-4 text-sm text-red-700 bg-red-50">{dealsError}</div>
              )}
              {deals == null && !dealsError && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="animate-spin mx-auto mb-2" size={18} /> Загрузка сделок…
                </div>
              )}
              {deals != null && visibleDeals.length === 0 && !dealsError && (
                <div className="py-10 text-center text-sm text-muted-foreground px-4">
                  Сделок на этапе «Расчет ставки» не найдено
                </div>
              )}
              {visibleDeals.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => applyDeal(d.id)}
                  disabled={prefilling != null}
                  className={cn(
                    "w-full text-left px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/40 disabled:opacity-50 transition-colors",
                    // Граница между «своими» и остальными — чтобы было видно, где чужие.
                    i > 0 && visibleDeals[i - 1].mine && !d.mine && "border-t-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{d.title}</span>
                    {d.mine && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                        моя
                      </span>
                    )}
                    {prefilling === d.id && (
                      <Loader2 size={12} className="animate-spin shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    #{d.id}
                    {(d.origin || d.destination) &&
                      ` · ${d.origin ?? "?"} → ${d.destination ?? "?"}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
