import { Icon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { proxy, useSnapshot } from 'valtio';
import { proxyMap } from 'valtio/utils';
import {
	Category,
	FilePathFilterArgs,
	ObjectFilterArgs,
	ObjectKindEnum,
	useLibraryMutation,
	useLibraryQuery,
	valtioPersist
} from '@sd/client';

import { FilterType } from './Filters';
import { inOrNotIn } from './util';

export type SearchType = 'paths' | 'objects';
export type SearchScope = 'directory' | 'location' | 'device' | 'library';

export interface FilterArgs {
	// unique identifier or enum value, any allows for enum values that coerce to string
	value: string | any;
	name: string;
	icon?: string; // "Folder" or "#efefef"
}

export interface Filter extends FilterArgs {
	type: FilterType;
}

export interface SetFilter extends Filter {
	condition: boolean;
	canBeRemoved: boolean;
}

export interface GroupedFilters {
	type: FilterType;
	filters: SetFilter[];
}

export interface FilterTypeMeta {
	name: string;
	icon: Icon;
	wording: {
		singular: string;
		plural?: string;
		singularNot: string;
		pluralNot?: string;
	};
}

const searchStore = proxy({
	isSearching: false,
	interactingWithSearchOptions: false,
	searchType: 'paths' as SearchType,
	searchQuery: null as string | null,
	registeredFilters: proxyMap() as Map<string, Filter>,
	selectedFilters: proxyMap() as Map<string, SetFilter>
});

// This hook has two main purposes, firstly to register and set fixed filters (e.g. location or tag)
// and secondly to return the search filters to be used in the query
// It also resets the search store when unmounted
export const useSearchFilters = <T extends SearchType>(
	searchType: T,
	fixedFilters?: Filter[]
): T extends 'objects' ? ObjectFilterArgs : FilePathFilterArgs => {
	const store = useSearchStore();

	// searchStore.searchType = searchType;

	useEffect(() => {
		// console.log({ fixedFilters: JSON.stringify(fixedFilters) });
		resetSearchStore();

		if (fixedFilters) {
			for (const filter of fixedFilters) {
				if (filter.name) {
					// to simplify syntax when defining fixed filters
					if (!filter.icon) filter.icon = filter.name;
					// register the filter as non-removable
					searchStore.registeredFilters.set(filter.value, filter);
					selectFilter(filter, true, false);
				}
			}
		}
		// fixed filters will never be too large to stringify as they're hardcoded
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [JSON.stringify(fixedFilters)]);

	const filters = useMemo(
		() => mapFiltersToQueryParams(Array.from(store.selectedFilters.values())),
		[store.selectedFilters]
	);

	// useEffect(() => {
	// 	if (store.searchQuery) {
	// 		filters.queryParams.search = store.searchQuery;
	// 	} else {
	// 		delete filters.queryParams.search;
	// 	}
	// }, [filters.queryParams, store.searchQuery]);

	return searchType === 'objects' ? (filters.objectFilters as any) : (filters.queryParams as any);
};

export const useSearchFilter = (
	type: FilterType,
	// meta: FilterTypeMeta,
	filterArgs?: FilterArgs[]
): (Filter & { key: string })[] => {
	const filters = useMemo(
		() =>
			(filterArgs || []).map((filter) => ({
				...filter,
				type,
				key: getKey({ ...filter, type })
			})),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[filterArgs?.length]
	);

	useEffect(
		() => {
			for (const filter of filters) {
				// only register filters that haven't already been registered
				if (!searchStore.registeredFilters.has(filter.key)) {
					// console.log('registering filter', filter);
					searchStore.registeredFilters.set(filter.key, filter);
				}
			}
		}, // eslint-disable-next-line react-hooks/exhaustive-deps
		[filterArgs?.length]
	);

	return filters;
};

// key doesn't have to be a particular format, just needs to be unique
// this key is also handy for text filtering
export const getKey = (filter: Filter) =>
	`${FilterType[filter.type]}-${filter.name}-${filter.value}`;

export const mapFiltersToQueryParams = (
	filters: SetFilter[]
): { queryParams: FilePathFilterArgs; objectFilters: ObjectFilterArgs } => {
	const queryParams: FilePathFilterArgs = {};
	const objectFilters: ObjectFilterArgs = {};

	filters.forEach((filter) => {
		switch (filter.type) {
			case FilterType.Location:
				queryParams.locations = inOrNotIn(
					queryParams.locations,
					parseInt(filter.value),
					filter.condition
				);
				break;

			case FilterType.Tag:
				objectFilters.tags = inOrNotIn(
					objectFilters.tags,
					parseInt(filter.value),
					filter.condition
				);
				break;

			case FilterType.Kind:
				objectFilters.kind = inOrNotIn(
					objectFilters.kind,
					parseInt(filter.value) as ObjectKindEnum,
					filter.condition
				);
				break;

			case FilterType.Category:
				objectFilters.category = inOrNotIn(
					objectFilters.category,
					filter.value as Category,
					filter.condition
				);
				break;

			case FilterType.Hidden:
				queryParams.hidden = filter.value === 'true';
				break;
		}
	});

	if (Object.keys(objectFilters).length > 0) {
		queryParams.object = objectFilters;
	}

	return { queryParams, objectFilters };
};

// return selected filters grouped by their type
export const getSelectedFiltersGrouped = (): GroupedFilters[] => {
	const groupedFilters: GroupedFilters[] = [];

	searchStore.selectedFilters.forEach((filter) => {
		const group = groupedFilters.find((group) => group.type === filter.type);
		if (group) {
			group.filters.push(filter);
		} else {
			groupedFilters.push({
				type: filter.type,
				filters: [filter]
			});
		}
	});

	return groupedFilters;
};

export const selectFilter = (filter: Filter, condition = true, canBeRemoved = true) => {
	const key = getKey(filter);
	searchStore.selectedFilters.set(key, {
		...filter,
		condition,
		canBeRemoved
	});
};

export const deselectFilter = (filter: Filter) => {
	const key = getKey(filter);
	const setFilter = searchStore.selectedFilters.get(key);
	if (setFilter?.canBeRemoved !== false) searchStore.selectedFilters.delete(key);
};

export const searchRegisteredFilters = (query: string) => {
	if (!query) return [];
	const keys = Array.from(searchStore.registeredFilters.keys()).filter(
		(filter) => filter?.toLowerCase().includes(query.toLowerCase())
	);
	return keys.map((key) => {
		const filter = searchStore.registeredFilters.get(key)!;
		return {
			...filter,
			key
		};
	});
};

export const resetSearchStore = () => {
	searchStore.searchQuery = null;
	searchStore.selectedFilters.clear();
};

export const useSavedSearches = () => {
	const savedSearches = useLibraryQuery(['search.savedSearches.list']);
	const createSavedSearch = useLibraryMutation(['search.savedSearches.create']);
	const removeSavedSearch = useLibraryMutation(['search.savedSearches.delete']);
	const searches = savedSearches.data || [];

	// const [selectedSavedSearch, setSelectedSavedSearch] = useState<number | null>(null);

	return {
		searches,
		loadSearch: (id: number) => {
			const search = searches?.find((search) => search.id === id);
			if (search) {
				searchStore.selectedFilters.clear();
				search.filters?.forEach(({ filter_type, name, value, icon }) => {
					const filter: Filter = {
						type: filter_type,
						name,
						value,
						icon: icon || ''
					};
					const key = getKey(filter);
					searchStore.registeredFilters.set(key, filter);
					selectFilter(filter, true);
				});
			}
		},
		removeSearch: (id: number) => {
			removeSavedSearch.mutate(id);
		},
		saveSearch: (name: string) => {
			const filters = Array.from(searchStore.selectedFilters.values());
			createSavedSearch.mutate({
				name,
				description: '',
				icon: '',
				filters: filters.map((filter) => ({
					filter_type: filter.type,
					name: filter.name,
					value: filter.value,
					icon: filter.icon || 'Folder'
				}))
			});
		}
	};
};

export const useSearchStore = () => useSnapshot(searchStore);

export const getSearchStore = () => searchStore;