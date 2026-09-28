import type { Locale } from '../schemas';

/** Russian — primary language. Every key must exist in `en.ts` too (checked by content.test.ts). */
export const ru: Locale = {
  'character.tavi.name': 'Тави',
  'error.webgl.title': 'Не удалось запустить 3D',
  'error.webgl.body':
    'Браузер не поддерживает WebGL2 или он отключён. Обновите браузер или включите аппаратное ускорение.',
};
