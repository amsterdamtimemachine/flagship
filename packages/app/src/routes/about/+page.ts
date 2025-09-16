import aboutContent from '../../content/about.md?raw';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
  return {
    content: aboutContent
  };
};