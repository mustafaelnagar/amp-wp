/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * WordPress dependencies
 */
import {
	ContrastChecker,
	FontSizePicker,
	InspectorControls,
	PanelColorSettings,
	withColors,
	withFontSizes,
} from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { withDispatch, withSelect } from '@wordpress/data';
import { compose, createHigherOrderComponent } from '@wordpress/compose';
import {
	IconButton,
	PanelBody,
	RangeControl,
	SelectControl,
	ToggleControl,
	withFallbackStyles,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { StoryBlockMover, FontFamilyPicker, ResizableBox, AnimationControls, RotatableBox } from '../';
import { ALLOWED_CHILD_BLOCKS, ALLOWED_MOVABLE_BLOCKS, BLOCKS_WITH_TEXT_SETTINGS, MIN_BLOCK_WIDTH, MIN_BLOCK_HEIGHT } from '../../stories-editor/constants';
import { getBlockOrderDescription, maybeEnqueueFontStyle } from '../../stories-editor/helpers';
import bringForwardIcon from '../../../images/bring-forward.svg';
import sendBackwardIcon from '../../../images/send-backwards.svg';
import bringFrontIcon from '../../../images/bring-front.svg';
import sendBackIcon from '../../../images/send-back.svg';

const { getComputedStyle, ampStoriesFonts } = window;

const applyFallbackStyles = withFallbackStyles( ( node, ownProps ) => {
	const { textColor, backgroundColor, fontSize, customFontSize } = ownProps;
	const editableNode = node.querySelector( '[contenteditable="true"]' );
	const computedStyles = editableNode ? getComputedStyle( editableNode ) : null;

	return {
		fallbackBackgroundColor: backgroundColor || ! computedStyles ? undefined : computedStyles.backgroundColor,
		fallbackTextColor: textColor || ! computedStyles ? undefined : computedStyles.color,
		fallbackFontSize: fontSize || customFontSize || ! computedStyles ? undefined : parseInt( computedStyles.fontSize ) || undefined,
	};
} );

const applyWithSelect = withSelect( ( select, props ) => {
	const { getSelectedBlockClientId, getBlockRootClientId, getBlock, getBlockOrder, getBlockIndex } = select( 'core/block-editor' );
	const { getAnimatedBlocks, isValidAnimationPredecessor } = select( 'amp/story' );
	const { getMedia } = select( 'core' );

	const currentBlock = getSelectedBlockClientId();
	const page = getBlockRootClientId( currentBlock );

	const animatedBlocks = getAnimatedBlocks()[ page ] || [];
	const animationOrderEntry = animatedBlocks.find( ( { id } ) => id === props.clientId );
	const parentBlockId = getBlockRootClientId( props.clientId );

	const blockClientIds = getBlockOrder( parentBlockId );
	const blockIndex = getBlockIndex( props.clientId, parentBlockId );

	const isVideoBlock = 'core/video' === props.name;
	let videoFeaturedImage;

	// If we have a video set from an attachment but there is no poster, use the featured image of the video if available.
	if ( isVideoBlock && props.attributes.id && ! props.attributes.poster ) {
		const media = getMedia( props.attributes.id );
		const featuredImage = media && get( media, [ '_links', 'wp:featuredmedia', 0, 'href' ], null );
		videoFeaturedImage = featuredImage && getMedia( Number( featuredImage.split( '/' ).pop() ) );
	}

	const reversedIndex = blockClientIds.length - 1 - blockIndex;

	return {
		currentBlockPosition: reversedIndex + 1,
		numberOfBlocks: blockClientIds.length,
		isFirst: 0 === blockIndex,
		isLast: blockIndex === blockClientIds.length - 1,
		parentBlock: getBlock( parentBlockId ),
		rootClientId: parentBlockId,
		// Use parent's clientId instead of anchor attribute.
		// The attribute will be updated via subscribers.
		animationAfter: animationOrderEntry ? animationOrderEntry.parent : undefined,
		getAnimatedBlocks() {
			return ( getAnimatedBlocks()[ page ] || [] )
				.filter( ( { id } ) => id !== currentBlock )
				.filter( ( { id } ) => {
					const block = getBlock( id );

					return block && block.attributes.ampAnimationType && isValidAnimationPredecessor( page, currentBlock, id );
				} )
				.map( ( { id } ) => {
					const block = getBlock( id );
					return {
						value: id,
						label: block.name,
						block,
						blockType: getBlockType( block.name ),
					};
				} );
		},
		videoFeaturedImage,
	};
} );

const applyWithDispatch = withDispatch( ( dispatch, { clientId, rootClientId, toggleSelection }, { select } ) => {
	const {
		getSelectedBlockClientId,
		getBlockRootClientId,
		getBlockOrder,
	} = select( 'core/block-editor' );
	const { moveBlocksDown, moveBlocksUp, moveBlockToPosition, selectBlock } = dispatch( 'core/block-editor' );

	const item = getSelectedBlockClientId();
	const page = getBlockRootClientId( item );

	const {
		addAnimation,
		changeAnimationType,
		changeAnimationDuration,
		changeAnimationDelay,
	} = dispatch( 'amp/story' );

	return {
		onAnimationTypeChange( type ) {
			changeAnimationType( page, item, type );
		},
		onAnimationOrderChange( predecessor ) {
			addAnimation( page, item, predecessor );
		},
		onAnimationDurationChange( value ) {
			changeAnimationDuration( page, item, value );
		},
		onAnimationDelayChange( value ) {
			changeAnimationDelay( page, item, value );
		},
		startBlockActions: () => toggleSelection( false ),
		stopBlockActions: () => {
			toggleSelection( true );
			selectBlock( clientId );
		},
		bringForward: () => moveBlocksDown( clientId, rootClientId ),
		sendBackward: () => moveBlocksUp( clientId, rootClientId ),
		moveFront: () => {
			const blockOrder = getBlockOrder( rootClientId );
			const topIndex = blockOrder.length - 1;
			moveBlockToPosition( clientId, rootClientId, rootClientId, topIndex );
		},
		moveBack: () => {
			moveBlockToPosition( clientId, rootClientId, rootClientId, 0 );
		},
	};
} );

const enhance = compose(
	withColors( 'backgroundColor', { textColor: 'color' } ),
	withFontSizes( 'fontSize' ),
	applyFallbackStyles,
	applyWithSelect,
	applyWithDispatch,
);

export default createHigherOrderComponent(
	( BlockEdit ) => {
		return enhance( ( props ) => {
			const {
				clientId,
				name,
				attributes,
				isSelected,
				isLast,
				isFirst,
				currentBlockPosition,
				numberOfBlocks,
				fontSize,
				setFontSize,
				setAttributes,
				backgroundColor,
				setBackgroundColor,
				textColor,
				setTextColor,
				fallbackBackgroundColor,
				fallbackTextColor,
				onAnimationTypeChange,
				onAnimationOrderChange,
				onAnimationDurationChange,
				onAnimationDelayChange,
				getAnimatedBlocks,
				animationAfter,
				videoFeaturedImage,
				startBlockActions,
				stopBlockActions,
				bringForward,
				sendBackward,
				moveFront,
				moveBack,
			} = props;

			const isChildBlock = ALLOWED_CHILD_BLOCKS.includes( name );

			if ( ! isChildBlock ) {
				return <BlockEdit { ...props } />;
			}

			const blockType = getBlockType( name );
			const isImageBlock = 'core/image' === name;
			const isVideoBlock = 'core/video' === name;
			const isTextBlock = 'amp/amp-story-text' === name;
			const needsTextSettings = BLOCKS_WITH_TEXT_SETTINGS.includes( name );
			const isMovableBlock = ALLOWED_MOVABLE_BLOCKS.includes( name );

			const {
				ampFontFamily,
				ampFitText,
				height,
				width,
				opacity,
				type: textBlockTextType,
				ampShowImageCaption,
				ampAnimationType,
				ampAnimationDuration,
				ampAnimationDelay,
				rotationAngle,
			} = attributes;

			// If we have a video set from an attachment but there is no poster, use the featured image of the video if available.
			if ( isVideoBlock && videoFeaturedImage ) {
				setAttributes( { poster: videoFeaturedImage.source_url } );
			}

			const isEmptyImageBlock = isImageBlock && ( ! attributes.url || ! attributes.url.length );

			return (
				<>
					{ isMovableBlock && (
						<StoryBlockMover
							clientId={ props.clientId }
							blockElementId={ `block-${ props.clientId }` }
							isDraggable={ ! props.isPartOfMultiSelection }
						/>
					) }
					{ ( ! isMovableBlock || isEmptyImageBlock ) && ( <BlockEdit { ...props } /> ) }
					{ isMovableBlock && ! isEmptyImageBlock && (
						<ResizableBox
							isSelected={ isSelected }
							width={ width }
							height={ height }
							angle={ rotationAngle }
							minHeight={ MIN_BLOCK_HEIGHT }
							minWidth={ MIN_BLOCK_WIDTH }
							onResizeStop={ ( value ) => {
								setAttributes( value );
								stopBlockActions();
							} }
							blockName={ name }
							ampFitText={ ampFitText }
							onResizeStart={ () => {
								startBlockActions();
							} }
						>
							<RotatableBox
								blockElementId={ `block-${ clientId }` }
								initialAngle={ rotationAngle }
								className="amp-story-editor__rotate-container"
								angle={ rotationAngle }
								onRotateStart={ () => {
									startBlockActions();
								} }
								onRotateStop={ ( event, angle ) => {
									setAttributes( {
										rotationAngle: angle,
									} );

									stopBlockActions();
								} }
							>
								<BlockEdit { ...props } />
							</RotatableBox>
						</ResizableBox>
					) }
					{ ! ( isLast && isFirst ) && (
						<InspectorControls>
							<PanelBody
								className="amp-story-order-controls"
								title={ __( 'Block Position', 'amp' ) }
							>
								<div className="amp-story-order-controls-wrap">
									<IconButton
										className="amp-story-controls-bring-front"
										onClick={ moveFront }
										icon={ bringFrontIcon( { width: 24, height: 24 } ) }
										label={ __( 'Send to front', 'amp' ) }
										aria-describedby={ `amp-story-controls-bring-front-description-${ clientId }` }
										aria-disabled={ isLast }
									>
										{ __( 'Front', 'amp' ) }
									</IconButton>
									<IconButton
										className="amp-story-controls-bring-forward"
										onClick={ bringForward }
										icon={ bringForwardIcon( { width: 24, height: 24 } ) }
										label={ __( 'Send Forward', 'amp' ) }
										aria-describedby={ `amp-story-controls-bring-forward-description-${ clientId }` }
										aria-disabled={ isLast }
									>
										{ __( 'Forward', 'amp' ) }
									</IconButton>
									<IconButton
										className="amp-story-controls-send-backwards"
										onClick={ sendBackward }
										icon={ sendBackwardIcon( { width: 24, height: 24 } ) }
										label={ __( 'Send Backward', 'amp' ) }
										aria-describedby={ `amp-story-controls-send-backward-description-${ clientId }` }
										aria-disabled={ isFirst }
									>
										{ __( 'Backward', 'amp' ) }
									</IconButton>
									<IconButton
										className="amp-story-controls-send-back"
										onClick={ moveBack }
										icon={ sendBackIcon( { width: 24, height: 24 } ) }
										label={ __( 'Send to back', 'amp' ) }
										aria-describedby={ `amp-story-controls-send-back-description-${ clientId }` }
										aria-disabled={ isFirst }
									>
										{ __( 'Back', 'amp' ) }
									</IconButton>
								</div>
								<span className="amp-story-controls-description" id={ `amp-story-controls-bring-front-description-${ clientId }` }>
									{
										getBlockOrderDescription(
											blockType && blockType.title,
											currentBlockPosition,
											1,
											isFirst,
											isLast,
											-1,
										)
									}
								</span>
								<span className="amp-story-controls-description" id={ `amp-story-controls-bring-forward-description-${ clientId }` }>
									{
										getBlockOrderDescription(
											blockType && blockType.title,
											currentBlockPosition,
											currentBlockPosition - 1,
											isFirst,
											isLast,
											-1,
										)
									}
								</span>
								<span className="amp-story-controls-description" id={ `amp-story-controls-send-backward-description-${ clientId }` }>
									{
										getBlockOrderDescription(
											blockType && blockType.title,
											currentBlockPosition,
											currentBlockPosition + 1,
											isFirst,
											isLast,
											1,
										)
									}
								</span>
								<span className="amp-story-controls-description" id={ `amp-story-controls-send-back-description-${ clientId }` }>
									{
										getBlockOrderDescription(
											blockType && blockType.title,
											currentBlockPosition,
											numberOfBlocks,
											isFirst,
											isLast,
											1,
										)
									}
								</span>
							</PanelBody>
						</InspectorControls>
					) }
					{ needsTextSettings && (
						<InspectorControls>
							<PanelBody title={ __( 'Text Settings', 'amp' ) }>
								<FontFamilyPicker
									fonts={ ampStoriesFonts }
									value={ ampFontFamily }
									onChange={ ( value ) => {
										maybeEnqueueFontStyle( value );
										setAttributes( { ampFontFamily: value } );
									} }
								/>
								<ToggleControl
									label={ __( 'Automatically fit text to container', 'amp' ) }
									checked={ ampFitText }
									onChange={ () => {
										setAttributes( { ampFitText: ! ampFitText } );
										if ( ! ampFitText ) {
											setFontSize( attributes.autoFontSize );
										}
									} }
								/>
								{ ! ampFitText && (
									<FontSizePicker
										value={ fontSize.size }
										onChange={ setFontSize }
									/>
								) }
								{ isTextBlock && (
									<SelectControl
										label={ __( 'Select text type', 'amp' ) }
										value={ textBlockTextType }
										onChange={ ( selected ) => setAttributes( { type: selected } ) }
										options={ [
											{ value: 'auto', label: __( 'Automatic', 'amp' ) },
											{ value: 'p', label: __( 'Paragraph', 'amp' ) },
											{ value: 'h1', label: __( 'Heading 1', 'amp' ) },
											{ value: 'h2', label: __( 'Heading 2', 'amp' ) },
										] }
									/>
								) }
							</PanelBody>
							<PanelColorSettings
								title={ __( 'Color Settings', 'amp' ) }
								initialOpen={ false }
								colorSettings={ [
									{
										value: backgroundColor.color,
										onChange: setBackgroundColor,
										label: __( 'Background Color', 'amp' ),
									},
									{
										value: textColor.color,
										onChange: setTextColor,
										label: __( 'Text Color', 'amp' ),
									},
								] }
							>
								<ContrastChecker
									{ ...{
										textColor: textColor.color,
										backgroundColor: backgroundColor.color,
										fallbackTextColor,
										fallbackBackgroundColor,
										fontSize: fontSize.size,
									} }
								/>
								<RangeControl
									label={ __( 'Background Opacity', 'amp' ) }
									value={ opacity }
									onChange={ ( value ) => setAttributes( { opacity: value } ) }
									min={ 5 }
									max={ 100 }
									step={ 5 }
								/>
							</PanelColorSettings>
						</InspectorControls>
					) }
					{ isMovableBlock && (
						<InspectorControls>
							<PanelBody
								title={ __( 'Animation', 'amp' ) }
							>
								<AnimationControls
									animatedBlocks={ getAnimatedBlocks }
									animationType={ ampAnimationType }
									animationDuration={ ampAnimationDuration ? parseInt( ampAnimationDuration ) : '' }
									animationDelay={ ampAnimationDelay ? parseInt( ampAnimationDelay ) : '' }
									animationAfter={ animationAfter }
									onAnimationTypeChange={ onAnimationTypeChange }
									onAnimationDurationChange={ onAnimationDurationChange }
									onAnimationDelayChange={ onAnimationDelayChange }
									onAnimationAfterChange={ onAnimationOrderChange }
								/>
							</PanelBody>
						</InspectorControls>
					) }
					{ isImageBlock && (
						<InspectorControls>
							<PanelBody
								title={ __( 'Story Settings', 'amp' ) }
							>
								<ToggleControl
									label={ __( 'Show or hide the caption', 'amp' ) }
									checked={ ampShowImageCaption }
									onChange={
										function() {
											props.setAttributes( { ampShowImageCaption: ! attributes.ampShowImageCaption } );
											if ( ! attributes.ampShowImageCaption ) {
												props.setAttributes( { caption: '' } );
											}
										}
									}
									help={ __( 'Toggle on to show image caption. If you turn this off the current caption text will be deleted.', 'amp' ) }
								/>
							</PanelBody>
						</InspectorControls>
					) }
				</>
			);
		} );
	},
	'withAmpStorySettings'
);
