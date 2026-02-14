<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	let {
		isFirst,
		isLast,
		hasFilledSets,
		saving,
		onprevious,
		onnext,
		onskip,
		onfinish,
		onaddexercise
	}: {
		isFirst: boolean;
		isLast: boolean;
		hasFilledSets: boolean;
		saving: boolean;
		onprevious: () => void;
		onnext: () => void;
		onskip: () => void;
		onfinish: () => void;
		onaddexercise: () => void;
	} = $props();

	let isSingle = $derived(isFirst && isLast);
</script>

<div
	class="fixed right-0 bottom-0 left-0 z-40 border-t border-tab-bar-border bg-tab-bar backdrop-blur-xl"
	style="padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));"
	data-testid="wizard-bottom-bar"
>
	<div class="mx-auto flex max-w-lg items-center justify-between gap-2 px-5 py-3">
		{#if isSingle}
			<Button
				variant="outline"
				class="min-h-11 flex-1 rounded-xl"
				onclick={onaddexercise}
				disabled={saving}
				data-testid="wizard-add-exercise-btn"
			>
				Add Exercise
			</Button>
			<Button
				class="min-h-11 flex-1 rounded-xl"
				onclick={onfinish}
				disabled={saving}
				data-testid="wizard-finish-btn"
			>
				{saving ? 'Saving...' : 'Finish'}
			</Button>
		{:else if isLast}
			<Button
				variant="outline"
				class="min-h-11 rounded-xl"
				onclick={onprevious}
				disabled={saving}
				data-testid="wizard-previous-btn"
			>
				Previous
			</Button>
			<Button
				variant="outline"
				class="min-h-11 flex-1 rounded-xl"
				onclick={onaddexercise}
				disabled={saving}
				data-testid="wizard-add-exercise-btn"
			>
				Add Exercise
			</Button>
			<Button
				class="min-h-11 flex-1 rounded-xl"
				onclick={onfinish}
				disabled={saving}
				data-testid="wizard-finish-btn"
			>
				{saving ? 'Saving...' : 'Finish'}
			</Button>
		{:else}
			{#if !isFirst}
				<Button
					variant="outline"
					class="min-h-11 rounded-xl"
					onclick={onprevious}
					disabled={saving}
					data-testid="wizard-previous-btn"
				>
					Previous
				</Button>
			{/if}
			<Button
				class="min-h-11 flex-1 rounded-xl"
				onclick={hasFilledSets ? onnext : onskip}
				disabled={saving}
				data-testid="wizard-next-btn"
			>
				{#if saving}
					Saving...
				{:else if hasFilledSets}
					Next
				{:else}
					Skip
				{/if}
			</Button>
		{/if}
	</div>
</div>
