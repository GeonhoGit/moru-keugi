/**
 * 큰 수(BigNumber) 어댑터.
 *
 * 계획서 3.4: "실제 구현에서는 이 값들을 일반 number가 아니라 문자열 직렬화를 지원하는
 * 큰 수 라이브러리의 곱셈·나눗셈·거듭제곱 API로 옮겨 작성한다."
 *
 * 게임 코드는 `break_infinity.js`를 직접 import 하지 않고 이 모듈만 사용한다.
 * 라이브러리를 교체하더라도 이 파일만 바꾸면 되도록 하기 위함이다.
 */
import Decimal from 'break_infinity.js';

export type Big = Decimal;
export type BigSource = Decimal | number | string;

export const big = (value: BigSource): Big => new Decimal(value);

export const ZERO: Big = new Decimal(0);
export const ONE: Big = new Decimal(1);

// ---------------------------------------------------------------------------
// 직렬화 (계획서 8.1 - 저장 데이터는 큰 수를 문자열로 보관한다)
// ---------------------------------------------------------------------------

/**
 * 저장용 문자열로 변환한다.
 *
 * 주의: 큰 수 라이브러리는 값을 가수 × 10^지수로 정규화하므로 `123456789` 같은 값이
 * `123456788.99999999`로 바뀔 수 있다. 상대 오차는 1e-8 수준이고, 한 번 정규화된 뒤에는
 * 저장·불러오기를 반복해도 값이 더 밀리지 않는다(멱등). 화면 표기는 `formatShort`가
 * 반올림하므로 플레이어에게는 드러나지 않는다.
 * 이 성질은 `storage/__tests__/saveManager.test.ts`에서 검증한다.
 */
export const toSaveString = (value: Big): string => value.toString();

/** 저장 문자열을 큰 수로 되돌린다. 형식이 깨졌으면 null을 반환한다. */
export const fromSaveString = (value: unknown): Big | null => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (!isValidBigString(value)) return null;
  const parsed = new Decimal(value);
  if (!isFiniteBig(parsed)) return null;
  return parsed;
};

/**
 * 저장 검증(8.4)의 "큰 수 문자열 형식" 항목.
 * `123`, `1.5e308`, `1e+1000`, `-4` 같은 표기만 허용한다.
 */
const BIG_STRING_PATTERN = /^-?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

export const isValidBigString = (value: unknown): value is string =>
  typeof value === 'string' && BIG_STRING_PATTERN.test(value.trim());

/** NaN / Infinity 를 걸러낸다. 장시간 테스트(17.3)의 필수 조건이다. */
export const isFiniteBig = (value: Big): boolean =>
  Number.isFinite(value.mantissa) &&
  Number.isFinite(value.exponent) &&
  !Number.isNaN(value.mantissa);

// ---------------------------------------------------------------------------
// 비교 도우미
// ---------------------------------------------------------------------------

export const isZero = (value: Big): boolean => value.sign() === 0;
export const isNegative = (value: Big): boolean => value.sign() < 0;

/** 음수를 0으로 잘라낸다. 재화가 음수가 되는 상태를 만들지 않기 위한 방어선이다. */
export const clampNonNegative = (value: Big): Big => (value.sign() < 0 ? ZERO : value);

// ---------------------------------------------------------------------------
// 화면 표기 (계획서 6.6 - 내부 값과 화면 표기를 분리한다)
// ---------------------------------------------------------------------------

export type NumberFormat = 'short' | 'korean';

const SHORT_UNITS = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
];

/** `1.25K`, `3.40M`, `7.82B` 형태로 표기한다. */
export const formatShort = (value: Big, decimals = 2): string => {
  if (!isFiniteBig(value)) return '∞';
  if (value.sign() < 0) return `-${formatShort(value.mul(-1), decimals)}`;
  if (value.lt(1000)) return trimTrailingZeros(value.toNumber().toFixed(value.lt(10) ? 1 : 0));

  const exponent = value.exponent;
  const unitIndex = Math.floor(exponent / 3);

  if (unitIndex >= SHORT_UNITS.length) {
    // 표기 단위를 벗어나면 지수 표기로 넘어간다.
    return `${value.mantissa.toFixed(decimals)}e${exponent}`;
  }

  const scaled = value.div(new Decimal(1).mul(new Decimal(10).pow(unitIndex * 3)));
  return `${trimTrailingZeros(scaled.toNumber().toFixed(decimals))}${SHORT_UNITS[unitIndex]}`;
};

const KOREAN_UNITS: ReadonlyArray<{ readonly exponent: number; readonly label: string }> = [
  { exponent: 48, label: '극' },
  { exponent: 44, label: '재' },
  { exponent: 40, label: '정' },
  { exponent: 36, label: '간' },
  { exponent: 32, label: '구' },
  { exponent: 28, label: '양' },
  { exponent: 24, label: '자' },
  { exponent: 20, label: '해' },
  { exponent: 16, label: '경' },
  { exponent: 12, label: '조' },
  { exponent: 8, label: '억' },
  { exponent: 4, label: '만' },
];

/** 한국식 단위(만·억·조) 표기. 설정에서 선택할 수 있게 하기 위한 확장 지점이다. */
export const formatKorean = (value: Big, decimals = 2): string => {
  if (!isFiniteBig(value)) return '∞';
  if (value.sign() < 0) return `-${formatKorean(value.mul(-1), decimals)}`;
  if (value.lt(10000)) return trimTrailingZeros(value.toNumber().toFixed(value.lt(10) ? 1 : 0));

  for (const unit of KOREAN_UNITS) {
    if (value.gte(new Decimal(10).pow(unit.exponent))) {
      const scaled = value.div(new Decimal(10).pow(unit.exponent));
      if (scaled.gte(1e6)) break; // 단위표 상한을 넘으면 지수 표기로 넘어간다.
      return `${trimTrailingZeros(scaled.toNumber().toFixed(decimals))}${unit.label}`;
    }
  }
  return `${value.mantissa.toFixed(decimals)}e${value.exponent}`;
};

export const formatNumber = (value: Big, format: NumberFormat = 'short', decimals = 2): string =>
  format === 'korean' ? formatKorean(value, decimals) : formatShort(value, decimals);

const trimTrailingZeros = (text: string): string =>
  text.includes('.') ? text.replace(/\.?0+$/, '') : text;

/**
 * 상점 UI(5.7)의 "구매 가능까지 약 18초" 표기용.
 * 초당 생산량이 0이면 null(= 도달 불가)을 돌려준다.
 */
export const secondsUntilAffordable = (
  cost: Big,
  currentEmber: Big,
  perSecond: Big,
): number | null => {
  if (currentEmber.gte(cost)) return 0;
  if (perSecond.sign() <= 0) return null;
  const seconds = cost.sub(currentEmber).div(perSecond).toNumber();
  return Number.isFinite(seconds) ? seconds : null;
};

/** `18초`, `4분 20초`, `2시간 5분` 형태의 한국어 경과 표기. */
export const formatDuration = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '-';
  const seconds = Math.floor(totalSeconds);
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}분` : `${m}분 ${s}초`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h === 0 ? `${d}일` : `${d}일 ${h}시간`;
};
