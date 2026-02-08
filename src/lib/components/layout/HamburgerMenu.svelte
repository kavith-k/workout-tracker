<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { Menu } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import NavLink from './NavLink.svelte';

	let open = $state(false);

	const navItems = [
		{ href: '/', label: 'Home' },
		{ href: '/history', label: 'History' },
		{ href: '/programs', label: 'Programs' },
		{ href: '/exercises', label: 'Exercises' },
		{ href: '/settings', label: 'Settings' }
	] as const;

	afterNavigate(() => {
		open = false;
	});
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" aria-label="Open menu">
				<Menu class="size-6" />
			</Button>
		{/snippet}
	</Sheet.Trigger>
	<Sheet.Content side="left" class="w-64">
		<Sheet.Header>
			<Sheet.Title>Workout Tracker</Sheet.Title>
		</Sheet.Header>
		<nav class="flex flex-col gap-1 px-2 py-4">
			{#each navItems as item (item.href)}
				<NavLink href={item.href} label={item.label} />
			{/each}
		</nav>
	</Sheet.Content>
</Sheet.Root>
