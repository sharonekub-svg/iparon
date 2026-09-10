/**
 * המחיר במקום אחד. מוצג בממשק ונשלח לספק התשלומים מאותו מקור,
 * כדי שלא ייווצר מצב שבו המסך אומר מחיר אחד והחיוב אחר.
 */
export const pricing = {
  /** באגורות. חיוב בשקלים חדשים. */
  amountAgorot: 3900,
  currency: 'ILS',
  /** מה שהתשלום פותח בכל פעם. */
  months: 1,
} as const;

/** "39" — מספר בלבד, כדי שאפשר יהיה לעטוף אותו ב-.num בממשק עברי. */
export const priceDigits = String(Math.round(pricing.amountAgorot / 100));
