export const CHECK_CONNECTION = 'Check your connection and try again.';

/** "Couldn’t load the history. Check your connection and try again." */
export const couldnt = (what: string) => `Couldn’t ${what}. ${CHECK_CONNECTION}`;
