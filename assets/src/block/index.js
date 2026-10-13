/**
 * Bloc « Diagnostic » : choix du diagnostic à afficher (rendu côté serveur).
 */
import { registerBlockType } from '@wordpress/blocks';
import { Placeholder, SelectControl, Spinner } from '@wordpress/components';
import { useBlockProps } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { __ } from '@wordpress/i18n';
import metadata from '../../../blocks/diagnostic/block.json';

function Edit( { attributes, setAttributes } ) {
	const blockProps = useBlockProps();
	const diagnostics = useSelect(
		( select ) =>
			select( coreStore ).getEntityRecords( 'postType', 'sd_diagnostic', {
				per_page: 100,
				status: 'publish,draft,private',
				_fields: 'id,title',
			} ),
		[]
	);

	const options = [
		{ value: 0, label: __( 'Choose a diagnostic…', 'smart-diagnostic' ) },
		...( diagnostics ?? [] ).map( ( post ) => ( {
			value: post.id,
			label: post.title?.rendered || `#${ post.id }`,
		} ) ),
	];

	return (
		<div { ...blockProps }>
			<Placeholder
				icon="clipboard"
				label={ __( 'Diagnostic', 'smart-diagnostic' ) }
			>
				{ diagnostics === null ? (
					<Spinner />
				) : (
					<SelectControl
						label={ __(
							'Diagnostic to display',
							'smart-diagnostic'
						) }
						value={ attributes.diagnosticId }
						options={ options }
						onChange={ ( value ) =>
							setAttributes( { diagnosticId: Number( value ) } )
						}
						__nextHasNoMarginBottom
					/>
				) }
			</Placeholder>
		</div>
	);
}

registerBlockType( metadata.name, {
	...metadata,
	edit: Edit,
	save: () => null,
} );
