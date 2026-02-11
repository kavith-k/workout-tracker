type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';

function getStoredTheme(): Theme {
	if (typeof window === 'undefined') return 'dark';
	return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'dark';
}

function getSystemDark(): boolean {
	if (typeof window === 'undefined') return true;
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') return getSystemDark() ? 'dark' : 'light';
	return theme;
}

function applyTheme(resolved: 'light' | 'dark') {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', resolved === 'dark');
}

let current = $state<Theme>(getStoredTheme());

export const themeStore = {
	get theme() {
		return current;
	},
	set theme(value: Theme) {
		current = value;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, value);
		}
		applyTheme(resolveTheme(value));
	},
	init() {
		current = getStoredTheme();
		applyTheme(resolveTheme(current));

		if (typeof window !== 'undefined') {
			const mql = window.matchMedia('(prefers-color-scheme: dark)');
			mql.addEventListener('change', () => {
				if (current === 'system') {
					applyTheme(resolveTheme('system'));
				}
			});
		}
	}
};
