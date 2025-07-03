import { Component, OnInit, OnDestroy } from '@angular/core';
import { JsonFormsAngularService, JsonFormsControl } from '@jsonforms/angular';
import { Actions, isStringControl, optionIs, RankedTester, rankWith } from '@jsonforms/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'custom-input-renderer',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="custom-input-container">
      <label *ngIf="label" class="custom-label">{{ label }}</label>
      <div class="custom-input-wrapper">
        <input
          class="custom-input"
          [type]="inputType"
          [value]="data || ''"
          [placeholder]="placeholder"
          [disabled]="!enabled"
          [required]="isRequired"
          (input)="handleInputChange($event)"
          (blur)="onBlur()"
          (focus)="onFocus()"
          [class.focused]="isFocused"
          [class.error]="hasError"
        />
        <div *ngIf="hasError" class="error-icon">⚠</div>
      </div>
      <div *ngIf="description" class="custom-description">{{ description }}</div>
      <div *ngIf="hasError && error" class="custom-error">
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .custom-input-container {
      margin-bottom: 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .custom-label {
      display: block;
      font-weight: 600;
      font-size: 0.875rem;
      color: #374151;
      margin-bottom: 0.5rem;
      transition: color 0.2s ease;
    }

    .custom-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .custom-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
      line-height: 1.5;
      background-color: #ffffff;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }

    .custom-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      background-color: #fefefe;
    }

    .custom-input.focused {
      border-color: #3b82f6;
    }

    .custom-input.error {
      border-color: #ef4444;
      background-color: #fef2f2;
    }

    .custom-input.error:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .custom-input:disabled {
      background-color: #f9fafb;
      color: #9ca3af;
      cursor: not-allowed;
      border-color: #e5e7eb;
    }

    .custom-input::placeholder {
      color: #9ca3af;
    }

    .error-icon {
      position: absolute;
      right: 0.75rem;
      color: #ef4444;
      font-size: 1.25rem;
      pointer-events: none;
    }

    .custom-description {
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #6b7280;
      line-height: 1.4;
    }

    .custom-error {
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #ef4444;
      font-weight: 500;
    }

    .custom-input-container.required .custom-label::after {
      content: ' *';
      color: #ef4444;
    }

    /* Hover effects */
    .custom-input:hover:not(:disabled):not(.error) {
      border-color: #9ca3af;
    }

    /* Animation for focus */
    @keyframes inputFocus {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.002);
      }
      100% {
        transform: scale(1);
      }
    }

    .custom-input.focused {
      animation: inputFocus 0.2s ease;
    }
  `]
})
export class CustomInputRendererComponent extends JsonFormsControl implements OnInit, OnDestroy {
  isFocused = false;
  inputType = 'text';
  
  private subscription?: Subscription;

  constructor(jsonformsService: JsonFormsAngularService) {
    super(jsonformsService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    
    // Determine input type based on schema
    if (this.path) {
      const schema = this.schema;
      if (schema?.format === 'email') {
        this.inputType = 'email';
      } else if (schema?.format === 'password') {
        this.inputType = 'password';
      } else if (schema?.type === 'number' || schema?.type === 'integer') {
        this.inputType = 'number';
      }
    }
  }

  override ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    super.ngOnDestroy();
  }

  handleInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    let value: any = target.value;
    
    console.log('CustomInputRendererComponent handleInputChange called', value, 'path:', this.path, 'current data:', this.data);
    
    // Convert value based on schema type
    if (this.schema?.type === 'number' || this.schema?.type === 'integer') {
      value = value === '' ? undefined : Number(value);
    } else if (this.schema?.type === 'boolean') {
      value = target.checked;
    }
    
    // Check if path is available, if not, try to get it from uischema
    let targetPath = this.path;
    if (!targetPath && this.uischema?.scope) {
      // Extract path from scope like "#/properties/name" -> "name"
      targetPath = this.uischema.scope.replace('#/properties/', '');
    }
    
    console.log('Using path:', targetPath);
    
    if (targetPath) {
      // Update the JsonForms core state using Actions.update
      this.jsonFormsService.updateCore(
        Actions.update(targetPath, () => value)
      );
      
      console.log('After update - data should be:', value, 'at path:', targetPath);
    } else {
      console.error('No path available for updating data', {
        path: this.path,
        scope: this.uischema?.scope,
        uischema: this.uischema
      });
    }
  }

  onFocus(): void {
    this.isFocused = true;
  }

  onBlur(): void {
    this.isFocused = false;
  }

  get placeholder(): string {
    return this.uischema?.options?.['placeholder'] || 
           `Enter ${this.label?.toLowerCase() || 'value'}`;
  }

  get hasError(): boolean {
    return this.error !== null && this.error !== undefined;
  }

  get isRequired(): boolean {
    return !!this.schema?.required?.includes(this.path?.split('/').pop() || '');
  }
}

// Tester function to determine when to use this renderer
export const customInputTester: RankedTester = rankWith(
  5, // Priority (higher than default renderers)
  (uischema, schema, context) => {
    // Use this renderer for string controls with a custom option
    return isStringControl(uischema, schema, context) && 
           optionIs('customStyle', true)(uischema, schema, context);
  }
);

// Export the renderer entry
export const customInputRendererEntry = {
  tester: customInputTester,
  renderer: CustomInputRendererComponent
};
