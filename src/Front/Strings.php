<?php
/**
 * Libellés par défaut de l'interface visiteur (traduisibles, surchargeables).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Front;

/**
 * Ordre de priorité : ui.strings de la config > filtre sd_ui_strings > traductions du plugin.
 */
final class Strings {

	/**
	 * @return array<string, string>
	 */
	public static function defaults(): array {
		$strings = array(
			'start'           => __( 'Start', 'smart-diagnostic' ),
			'next'            => __( 'Next', 'smart-diagnostic' ),
			'back'            => __( 'Back', 'smart-diagnostic' ),
			'submit'          => __( 'See my results', 'smart-diagnostic' ),
			'skip'            => __( 'Skip', 'smart-diagnostic' ),
			'resumeTitle'     => __( 'Welcome back!', 'smart-diagnostic' ),
			'resumeText'      => __( 'Would you like to continue where you left off?', 'smart-diagnostic' ),
			'resume'          => __( 'Continue', 'smart-diagnostic' ),
			'restart'         => __( 'Start over', 'smart-diagnostic' ),
			'progress'        => __( 'Step {current} of {total}', 'smart-diagnostic' ),
			'required'        => __( 'This field is required.', 'smart-diagnostic' ),
			'invalidEmail'    => __( 'Please enter a valid email address.', 'smart-diagnostic' ),
			'invalidPhone'    => __( 'Please enter a valid phone number.', 'smart-diagnostic' ),
			'invalidNumber'   => __( 'Please enter a number.', 'smart-diagnostic' ),
			'min'             => __( 'The minimum value is {min}.', 'smart-diagnostic' ),
			'max'             => __( 'The maximum value is {max}.', 'smart-diagnostic' ),
			'minLength'       => __( 'Please enter at least {min} characters.', 'smart-diagnostic' ),
			'maxLength'       => __( 'Please enter at most {max} characters.', 'smart-diagnostic' ),
			'pattern'         => __( 'The format is not valid.', 'smart-diagnostic' ),
			'minSelected'     => __( 'Please select at least {min} options.', 'smart-diagnostic' ),
			'maxSelected'     => __( 'Please select at most {max} options.', 'smart-diagnostic' ),
			'consentRequired' => __( 'Please accept to continue.', 'smart-diagnostic' ),
			'yes'             => __( 'Yes', 'smart-diagnostic' ),
			'no'              => __( 'No', 'smart-diagnostic' ),
			'selectPlaceholder' => __( 'Choose…', 'smart-diagnostic' ),
			'resultsTitle'    => __( 'Your results', 'smart-diagnostic' ),
			'resultsPending'  => __( 'Thank you! Your answers have been recorded.', 'smart-diagnostic' ),
			'perOnce'         => '',
			'perDay'          => __( '/ day', 'smart-diagnostic' ),
			'perWeek'         => __( '/ week', 'smart-diagnostic' ),
			'perMonth'        => __( '/ month', 'smart-diagnostic' ),
			'perQuarter'      => __( '/ quarter', 'smart-diagnostic' ),
			'perYear'         => __( '/ year', 'smart-diagnostic' ),
			'total'           => __( 'Total', 'smart-diagnostic' ),
			'language'        => __( 'Language', 'smart-diagnostic' ),
		);

		/**
		 * Libellés par défaut de l'interface visiteur.
		 *
		 * @param array<string, string> $strings Libellés indexés par clé.
		 */
		return (array) apply_filters( 'sd_ui_strings', $strings );
	}
}
