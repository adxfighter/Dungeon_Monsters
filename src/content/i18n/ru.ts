import type { Locale } from '../schemas';

/** Russian — primary language. Every key must exist in `en.ts` too (checked by content.test.ts). */
export const ru: Locale = {
  'character.tavi.name': 'Тави',
  'monster.bubbler.name': 'Пузырник',
  'monster.sparkhog.name': 'Искроёж',
  'monster.stonenibbler.name': 'Кроль-камнеед',
  'hud.attack': 'Удар',
  'hud.dodge': 'Рывок',
  'hud.wave': 'Волна',
  'hud.defeated': 'Вас вынесли',
  'hud.cleared': 'Арена зачищена!',
  'hud.restart': 'Ещё раз',
  'hud.blocked': 'Блок!',
  'hud.settings': 'Настройки',
  'settings.shake': 'Тряска камеры',
  'settings.haptics': 'Вибрация',
  'settings.testVibration': 'Проверить вибрацию',
  'settings.buttonsSide': 'Кнопки',
  'settings.side.left': 'Слева',
  'settings.side.right': 'Справа',
  'error.webgl.title': 'Не удалось запустить 3D',
  'error.webgl.body':
    'Браузер не поддерживает WebGL2 или он отключён. Обновите браузер или включите аппаратное ускорение.',
};
