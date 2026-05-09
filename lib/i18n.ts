export type Lang = 'en' | 'ja' | 'ko' | 'zh'

type Strings = {
  welcome: string
  night: string
  nights: string
  back: string
  backToHotel: string
  noOffers: string
  addBtn: string
  addedBtn: string
  addBundleBtn: string
  bundleLabel: string
  onlyLeft: (n: number) => string
  cartItems: (n: number) => string
  checkoutBtn: string
  cartEmpty: string
  yourAddons: string
  reviewBefore: string
  total: string
  roomBillNote: string
  confirmPay: string
  bookingConfirmed: string
  addonsReady: string
  farewell: string
  channel: Record<string, string>
  units: Record<string, string>
  dateLocale: string
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    welcome: 'Welcome,',
    night: 'night',
    nights: 'nights',
    back: '← Back',
    backToHotel: '← Back to Hotel',
    noOffers: '─ No offers available at this time ─',
    addBtn: 'Add +',
    addedBtn: '✓ Added',
    addBundleBtn: 'Add Bundle +',
    bundleLabel: 'BEST VALUE SET',
    onlyLeft: (n) => `Only ${n} left`,
    cartItems: (n) => `${n} item${n > 1 ? 's' : ''}`,
    checkoutBtn: 'Checkout →',
    cartEmpty: 'Your cart is empty',
    yourAddons: 'Your Add-ons',
    reviewBefore: 'Review before confirming',
    total: 'Total',
    roomBillNote: 'Charges will be added to your room bill at check-out.',
    confirmPay: 'Confirm & Pay',
    bookingConfirmed: 'Booking Confirmed',
    addonsReady: 'Your add-ons have been reserved and will be ready on arrival.',
    farewell: 'We look forward to welcoming you.',
    channel: {
      LINE: 'Sent via LINE',
      WhatsApp: 'Sent via WhatsApp',
      SMS: 'Sent via SMS',
      Email: 'Sent via Email',
    },
    units: {
      per_stay: 'per stay',
      per_night: 'per night',
      per_person: 'per person',
      per_person_per_day: 'per person / day',
      per_trip: 'per trip',
    },
    dateLocale: 'en-US',
  },
  ja: {
    welcome: 'ようこそ、',
    night: '泊',
    nights: '泊',
    back: '← 戻る',
    backToHotel: '← ホテルに戻る',
    noOffers: '─ 現在利用可能なオファーはありません ─',
    addBtn: '追加 +',
    addedBtn: '✓ 追加済み',
    addBundleBtn: 'セットを追加 +',
    bundleLabel: 'おすすめセット',
    onlyLeft: (n) => `残り${n}個`,
    cartItems: (n) => `${n}点`,
    checkoutBtn: '決済へ →',
    cartEmpty: 'カートは空です',
    yourAddons: 'ご注文内容',
    reviewBefore: 'ご確認ください',
    total: '合計',
    roomBillNote: 'チェックアウト時に客室料金に加算されます。',
    confirmPay: '確定する',
    bookingConfirmed: '予約が確定しました',
    addonsReady: 'ご注文のサービスはご到着時にご用意いたします。',
    farewell: 'またのお越しをお待ちしております',
    channel: {
      LINE: 'LINEで送信',
      WhatsApp: 'WhatsAppで送信',
      SMS: 'SMSで送信',
      Email: 'メールで送信',
    },
    units: {
      per_stay: '滞在中',
      per_night: '1泊あたり',
      per_person: '1名あたり',
      per_person_per_day: '1名・1日あたり',
      per_trip: '1回あたり',
    },
    dateLocale: 'ja-JP',
  },
  ko: {
    welcome: '환영합니다,',
    night: '박',
    nights: '박',
    back: '← 뒤로',
    backToHotel: '← 호텔로 돌아가기',
    noOffers: '─ 현재 이용 가능한 오퍼가 없습니다 ─',
    addBtn: '추가 +',
    addedBtn: '✓ 추가됨',
    addBundleBtn: '패키지 추가 +',
    bundleLabel: '추천 패키지',
    onlyLeft: (n) => `${n}개 남음`,
    cartItems: (n) => `${n}개`,
    checkoutBtn: '결제하기 →',
    cartEmpty: '장바구니가 비어 있습니다',
    yourAddons: '선택한 서비스',
    reviewBefore: '확인 후 결제하세요',
    total: '합계',
    roomBillNote: '체크아웃 시 객실 요금에 추가됩니다.',
    confirmPay: '결제 확인',
    bookingConfirmed: '예약이 확정되었습니다',
    addonsReady: '선택하신 서비스는 도착 시 준비되어 있을 것입니다.',
    farewell: '다시 방문해 주시기를 기다리겠습니다.',
    channel: {
      LINE: 'LINE으로 전송',
      WhatsApp: 'WhatsApp으로 전송',
      SMS: 'SMS로 전송',
      Email: '이메일로 전송',
    },
    units: {
      per_stay: '숙박 당',
      per_night: '1박 당',
      per_person: '1인 당',
      per_person_per_day: '1인 1일 당',
      per_trip: '1회 당',
    },
    dateLocale: 'ko-KR',
  },
  zh: {
    welcome: '欢迎，',
    night: '晚',
    nights: '晚',
    back: '← 返回',
    backToHotel: '← 返回酒店',
    noOffers: '─ 暂无可用优惠 ─',
    addBtn: '添加 +',
    addedBtn: '✓ 已添加',
    addBundleBtn: '添加套餐 +',
    bundleLabel: '推荐套餐',
    onlyLeft: (n) => `仅剩${n}个`,
    cartItems: (n) => `${n}件`,
    checkoutBtn: '去结账 →',
    cartEmpty: '购物车是空的',
    yourAddons: '已选服务',
    reviewBefore: '确认后提交',
    total: '合计',
    roomBillNote: '费用将在退房时计入房费。',
    confirmPay: '确认支付',
    bookingConfirmed: '预订已确认',
    addonsReady: '您选择的服务将在您到达时为您准备好。',
    farewell: '期待您的再次光临',
    channel: {
      LINE: '通过LINE发送',
      WhatsApp: '通过WhatsApp发送',
      SMS: '通过短信发送',
      Email: '通过邮件发送',
    },
    units: {
      per_stay: '每次入住',
      per_night: '每晚',
      per_person: '每人',
      per_person_per_day: '每人每天',
      per_trip: '每次',
    },
    dateLocale: 'zh-CN',
  },
}

export function getStrings(lang: string): Strings {
  return STRINGS[lang as Lang] ?? STRINGS.en
}
