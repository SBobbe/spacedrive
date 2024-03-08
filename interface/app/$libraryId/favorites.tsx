import {
	createDefaultExplorerSettings,
	EmptyNotice,
	Explorer,
	ExplorerContextProvider,
	objectOrderingKeysSchema,
	useExplorerSettings,
	useObjectsExplorerQuery
} from '@sd/explorer';
import { Icon, useRouteTitle } from '@sd/web-core';
import { useMemo } from 'react';
import { ObjectKindEnum, ObjectOrder, SearchFilterArgs } from '@sd/client';

import { DefaultTopBarOptions } from './Layout/TopBarOptions';
import { SearchContextProvider, SearchOptions, useSearch } from './search';
import SearchBar from './search/SearchBar';
import { TopBarPortal } from './TopBar/Portal';
import { useLibraryExplorer } from './useLibraryExplorer';

export function Component() {
	useRouteTitle('Favorites');

	const explorerSettings = useExplorerSettings({
		settings: useMemo(() => {
			return createDefaultExplorerSettings<ObjectOrder>({ order: null });
		}, []),
		orderingKeys: objectOrderingKeysSchema
	});

	const explorerSettingsSnapshot = explorerSettings.useSettingsSnapshot();

	const fixedFilters = useMemo<SearchFilterArgs[]>(
		() => [
			// { object: { favorite: true } },
			...(explorerSettingsSnapshot.layoutMode === 'media'
				? [{ object: { kind: { in: [ObjectKindEnum.Image, ObjectKindEnum.Video] } } }]
				: [])
		],
		[explorerSettingsSnapshot.layoutMode]
	);

	const search = useSearch({
		fixedFilters
	});

	const objects = useObjectsExplorerQuery({
		arg: {
			take: 100,
			filters: [
				...search.allFilters,
				// TODO: Add filter to search options
				{ object: { favorite: true } }
			]
		},
		explorerSettings
	});

	const explorer = useLibraryExplorer({
		...objects,
		isFetchingNextPage: objects.query.isFetchingNextPage,
		settings: explorerSettings
	});

	return (
		<ExplorerContextProvider explorer={explorer}>
			<SearchContextProvider search={search}>
				<TopBarPortal
					center={<SearchBar />}
					left={
						<div className="flex flex-row items-center gap-2">
							<span className="truncate text-sm font-medium">Favorites</span>
						</div>
					}
					right={<DefaultTopBarOptions />}
				>
					{search.open && (
						<>
							<hr className="w-full border-t border-sidebar-divider bg-sidebar-divider" />
							<SearchOptions />
						</>
					)}
				</TopBarPortal>
			</SearchContextProvider>

			<Explorer
				emptyNotice={
					<EmptyNotice
						icon={<Icon name="Heart" size={128} />}
						message="No favorite items"
					/>
				}
			/>
		</ExplorerContextProvider>
	);
}
