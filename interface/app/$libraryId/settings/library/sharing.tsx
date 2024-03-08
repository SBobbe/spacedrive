import { useLocale } from '@sd/web-core';

import { Heading } from '../Layout';

export const Component = () => {
	const { t } = useLocale();
	return (
		<>
			<Heading title={t('sharing')} description={t('sharing_description')} />
		</>
	);
};
