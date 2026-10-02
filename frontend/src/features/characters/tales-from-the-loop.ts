// The supported system owns its sheet layout and field definitions.
export type CharacterField = {
  key: string;
  label: string;
  section: 'identity' | 'attributes' | 'skills' | 'story' | 'conditions';
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: string[];
};
export type CharacterSheet = { fields: CharacterField[] };
export const talesFromTheLoop: CharacterSheet = {
  fields: [
    {
      key: 'age',
      label: 'Age',
      section: 'identity',
      type: 'number',
      required: true,
      min: 10,
      max: 19,
    },
    {
      key: 'type',
      label: 'Type',
      section: 'identity',
      type: 'select',
      required: true,
      options: [
        'BOOKWORM',
        'COMPUTER_GEEK',
        'JOCK',
        'POPULAR_KID',
        'ROCKER',
        'TROUBLEMAKER',
        'WEIRDO',
      ],
    },
    {
      key: 'body',
      label: 'Body',
      section: 'attributes',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'tech',
      label: 'Tech',
      section: 'attributes',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'heart',
      label: 'Heart',
      section: 'attributes',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'mind',
      label: 'Mind',
      section: 'attributes',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'force',
      label: 'Force',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'move',
      label: 'Move',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'sneak',
      label: 'Sneak',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'tinker',
      label: 'Tinker',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'program',
      label: 'Program',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'calculate',
      label: 'Calculate',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'contact',
      label: 'Contact',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'charm',
      label: 'Charm',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'lead',
      label: 'Lead',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'investigate',
      label: 'Investigate',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'comprehend',
      label: 'Comprehend',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'empathize',
      label: 'Empathize',
      section: 'skills',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      key: 'drive',
      label: 'Drive',
      section: 'story',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'pride',
      label: 'Pride',
      section: 'story',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'problem',
      label: 'Problem',
      section: 'story',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'anchor',
      label: 'Anchor',
      section: 'story',
      type: 'string',
      maxLength: 500,
    },
    {
      key: 'iconicItem',
      label: 'Iconic item',
      section: 'story',
      type: 'string',
      maxLength: 100,
    },
    {
      key: 'relationships',
      label: 'Relationships',
      section: 'story',
      type: 'string',
      maxLength: 2000,
    },
    {
      key: 'favoriteSong',
      label: 'Favourite song',
      section: 'story',
      type: 'string',
      maxLength: 200,
    },
    {
      key: 'inventory',
      label: 'Inventory',
      section: 'story',
      type: 'string',
      maxLength: 2000,
    },
    {
      key: 'luckPoints',
      label: 'Luck points',
      section: 'story',
      type: 'number',
      min: 0,
      max: 6,
    },
    {
      key: 'upset',
      label: 'Upset',
      section: 'conditions',
      type: 'boolean',
    },
    {
      key: 'scared',
      label: 'Scared',
      section: 'conditions',
      type: 'boolean',
    },
    {
      key: 'exhausted',
      label: 'Exhausted',
      section: 'conditions',
      type: 'boolean',
    },
    {
      key: 'injured',
      label: 'Injured',
      section: 'conditions',
      type: 'boolean',
    },
    {
      key: 'broken',
      label: 'Broken',
      section: 'conditions',
      type: 'boolean',
    },
  ],
};
export function characterSheet(
  system: string | null | undefined,
): CharacterSheet | undefined {
  return system === 'TALES_FROM_THE_LOOP' ? talesFromTheLoop : undefined;
}
