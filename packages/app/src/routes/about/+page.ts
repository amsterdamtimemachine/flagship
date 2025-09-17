import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  try {
    const response = await fetch('/content/about.md');
    const content = await response.text();
    
    return {
      content
    };
  } catch (error) {
    console.error('Failed to load about content:', error);
    return {
      content: '# About\n\nContent could not be loaded.'
    };
  }
};