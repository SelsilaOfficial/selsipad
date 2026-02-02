/**
 * Structured logging utility for Fairlaunch deployment
 * Provides consistent error tracking and debugging
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  userId?: string;
  chainId?: number;
  contractAddress?: string;
  txHash?: string;
  launchRoundId?: string;
  [key: string]: any;
}

class DeploymentLogger {
  private serviceName = 'FairlaunchDeployment';

  /**
   * Log with structured format
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const timestamp = new Date().toISOString();
    const logEntry: Record<string, any> = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...context,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Format for console
    const prefix = `[${timestamp}] [${level}] [${this.serviceName}]`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, context);
        break;
      case LogLevel.INFO:
        console.log(prefix, message, context);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, context);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, context, error);
        break;
    }

    // In production, you could send to external logging service
    // e.g., Sentry, DataDog, CloudWatch, etc.
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log deployment start
   */
  logDeploymentStart(userId: string, chainId: number, tokenAddress: string) {
    this.info('Deployment initiated', {
      userId,
      chainId,
      tokenAddress,
      phase: 'START',
    });
  }

  /**
   * Log validation failure
   */
  logValidationFailure(userId: string, errors: string[]) {
    this.warn('Validation failed', {
      userId,
      phase: 'VALIDATION',
      errors,
    });
  }

  /**
   * Log token approval check
   */
  logTokenCheckResult(
    userId: string,
    tokenAddress: string,
    isValid: boolean,
    errors?: string[]
  ) {
    if (isValid) {
      this.info('Token approval check passed', {
        userId,
        tokenAddress,
        phase: 'TOKEN_CHECK',
      });
    } else {
      this.warn('Token approval check failed', {
        userId,
        tokenAddress,
        phase: 'TOKEN_CHECK',
        errors,
      });
    }
  }

  /**
   * Log deployment transaction
   */
  logDeploymentTransaction(
    userId: string,
    chainId: number,
    txHash: string,
    contractAddress: string
  ) {
    this.info('Contract deployed', {
      userId,
      chainId,
      txHash,
      contractAddress,
      phase: 'DEPLOY',
    });
  }

  /**
   * Log deployment failure
   */
  logDeploymentFailure(
    userId: string,
    chainId: number,
    error: Error,
    context?: LogContext
  ) {
    this.error('Deployment failed', {
      userId,
      chainId,
      phase: 'DEPLOY',
      ...context,
    }, error);
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(
    operation: string,
    success: boolean,
    launchRoundId?: string,
    error?: Error
  ) {
    if (success) {
      this.info(`Database ${operation} successful`, {
        launchRoundId,
        phase: 'DATABASE',
      });
    } else {
      this.error(`Database ${operation} failed`, {
        launchRoundId,
        phase: 'DATABASE',
      }, error);
    }
  }

  /**
   * Log verification queue
   */
  logVerificationQueued(
    launchRoundId: string,
    contractAddress: string,
    jobId: string
  ) {
    this.info('Verification job queued', {
      launchRoundId,
      contractAddress,
      jobId,
      phase: 'VERIFICATION',
    });
  }

  /**
   * Log API response
   */
  logApiResponse(
    userId: string,
    statusCode: number,
    success: boolean,
    duration?: number
  ) {
    const method = success ? 'info' : 'error';
    this[method]('API response sent', {
      userId,
      statusCode,
      success,
      duration,
      phase: 'RESPONSE',
    });
  }
}

// Export singleton instance
export const deploymentLogger = new DeploymentLogger();
