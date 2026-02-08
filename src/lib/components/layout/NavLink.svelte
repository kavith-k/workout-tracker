<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';

	let { href, label }: { href: Pathname; label: string } = $props();

	let isActive = $derived(
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href)
	);
</script>

<a
	href={resolve(href)}
	class={[
		'flex min-h-11 items-center rounded-md px-3 text-base font-medium transition-colors',
		isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
	]}
>
	{label}
</a>
