import type { Lang } from "~/shared/domain";
import { en } from "./en";
import { fr, type Dict } from "./fr";
import { pt } from "./pt";

export type { Dict };

export const dictionaries: Record<Lang, Dict> = { fr, en, pt };

export const dictFor = (lang: Lang): Dict => dictionaries[lang];
