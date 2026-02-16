<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { House, Clock, LayoutList, Dumbbell, Settings } from '@lucide/svelte';
	import type { Pathname } from '$app/types';

	const tabs = [
		{ href: '/' as Pathname, label: 'Home', icon: House },
		{ href: '/history' as Pathname, label: 'History', icon: Clock },
		{ href: '/programs' as Pathname, label: 'Programs', icon: LayoutList },
		{ href: '/exercises' as Pathname, label: 'Exercises', icon: Dumbbell },
		{ href: '/settings' as Pathname, label: 'Settings', icon: Settings }
	] as const;

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<nav
	class="fixed right-0 bottom-0 left-0 z-50 border-t border-tab-bar-border bg-tab-bar backdrop-blur-xl"
>
	<div
		class="mx-auto flex max-w-lg items-stretch justify-around"
		style="padding-bottom: max(calc(env(safe-area-inset-bottom, 0px) - 10px), 6px);"
	>
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href)}
			<a
				href={resolve(tab.href as `/`)}
				class="flex min-h-[50px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-center transition-colors {active
					? 'text-neon'
					: 'text-muted-foreground'}"
			>
				<tab.icon class="size-[22px] {active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}" />
				<span class="text-[10px] leading-tight font-medium">{tab.label}</span>
				{#if active}<div class="mt-0.5 h-[3px] w-[3px] rounded-full bg-neon"></div>{/if}
			</a>
		{/each}
	</div>
</nav>
