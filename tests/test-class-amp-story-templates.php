<?php
/**
 * Test AMP_Story_Templates.
 *
 * @package AMP
 */

/**
 * Test AMP_Story_Post_Type.
 */
class AMP_Story_Templates_Test extends WP_UnitTestCase {

	/**
	 * Setup.
	 *
	 * @inheritdoc
	 */
	public function setUp() {
		parent::setUp();

		foreach ( WP_Block_Type_Registry::get_instance()->get_all_registered() as $block ) {
			if ( 'amp/' === substr( $block->name, 0, 4 ) ) {
				WP_Block_Type_Registry::get_instance()->unregister( $block->name );
			}
		}

		AMP_Story_Post_Type::register();
	}

	/**
	 * Test init().
	 *
	 * @covers AMP_Story_Templates::init()
	 */
	public function test_init() {
		if ( ! function_exists( 'register_block_type' ) ) {
			$this->markTestSkipped( 'The function register_block_type() is not present, so the AMP Story post type was not registered.' );
		}

		$amp_story_templates = new AMP_Story_Templates();
		$amp_story_templates->init();

		$this->assertTrue( post_type_exists( 'amp_story' ) );
		$this->assertEquals( 10, has_action( 'rest_wp_block_query', array( $amp_story_templates, 'filter_rest_wp_block_query' ) ) );
		$this->assertEquals( 10, has_action( 'save_post_wp_block', array( $amp_story_templates, 'flag_template_as_modified' ) ) );
		$this->assertEquals( 10, has_action( 'user_has_cap', array( $amp_story_templates, 'filter_user_has_cap' ) ) );
		$this->assertEquals( 10, has_action( 'pre_get_posts', array( $amp_story_templates, 'filter_pre_get_posts' ) ) );
	}

	/**
	 * Test filter_user_has_cap().
	 *
	 * @covers AMP_Story_Templates::filter_user_has_cap()
	 */
	public function test_filter_user_has_cap() {
		if ( ! function_exists( 'register_block_type' ) ) {
			$this->markTestSkipped( 'The function register_block_type() is not present, so the AMP Story post type was not registered.' );
		}

		$story_id = $this->factory()->post->create( array( 'post_type' => AMP_Story_Post_Type::POST_TYPE_SLUG ) );
		wp_set_object_terms( $story_id, AMP_Story_Templates::TEMPLATES_TERM, AMP_Story_Templates::TEMPLATES_TAXONOMY );

		$amp_story_templates = new AMP_Story_Templates();
		$amp_story_templates->init();

		$allcaps = array(
			'edit_others_posts'    => true,
			'edit_published_posts' => true,
		);
		$args    = array(
			0 => 'edit_post',
			2 => $story_id,
		);

		$capabilities = $amp_story_templates->filter_user_has_cap( $allcaps, array(), $args );
		$this->assertTrue( has_term( AMP_Story_Templates::TEMPLATES_TERM, AMP_Story_Templates::TEMPLATES_TAXONOMY, $args[2] ) );
		$this->assertEquals( array(), $capabilities );
	}
}
