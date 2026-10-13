<?php
/**
 * Erreur de syntaxe d'une expression.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Levée par Expression::parse() pour une expression invalide.
 */
final class ExpressionError extends \InvalidArgumentException {}
