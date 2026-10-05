const dateFormat = new Intl.DateTimeFormat("ro-MD", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Chisinau" });
const moneyFormat = new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 });

export const formatDate = (value: string) => dateFormat.format(new Date(value));
export const formatMoney = (value: number | string) => `${moneyFormat.format(Number(value))} MDL`;
