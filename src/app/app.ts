import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { angularMaterialRenderers } from '@jsonforms/angular-material';
import { and, createAjv, isControl, optionIs, rankWith, schemaTypeIs, scopeEndsWith, Tester } from '@jsonforms/core';
import { customInputRendererEntry } from './custom-input-renderer.component';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import { JsonFormsModule } from '@jsonforms/angular';
import $RefParser from "@apidevtools/json-schema-ref-parser";
import fieldsData from './Fields.json';
import schema from './Schemas.json';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,
       JsonFormsModule,
       FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  protected title = 'jsonForms';
    ajv = createAjv({
    schemaId: 'id',
    allErrors: true
  });
   renderers = [
    customInputRendererEntry,
    ...angularMaterialRenderers,
  ];
      schema: JsonSchema = {
       type: 'object',
       properties: {
         name: {
           type: 'string'
         }
       }
     };

     uischema: UISchemaElement = {
       type: 'Control',
       scope: '#/properties/name'
     };

     data: any = {};

  // Text editor properties
  schemaText: string = '';
  uischemaText: string = '';
  dataText: string = '';
  generatedSchemaText: string = ""
  mergedSchema: any = null;
  mergedSchemaText: string = '';
 
  constructor(private cdr: ChangeDetectorRef) {
    // Initialize text editors with current JSON values
    this.schemaText = JSON.stringify(this.schema, null, 2);
    this.uischemaText = JSON.stringify(this.uischema, null, 2);
    this.dataText = JSON.stringify(this.data, null, 2);
  }

  async ngOnInit() {
    // Use setTimeout to ensure this happens after initial change detection
    setTimeout(async () => {
      await this.mergeSchemas();
    }, 0);
  }

  async mergeSchemas() {
    try {
      // Create a combined schema structure
      const combinedSchema: any = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        definitions: {
          fields: {} as any,
          objects: {} as any
        }
      };

      // Add fields to definitions
      fieldsData.Fields.forEach((field: any) => {
        if (field.$id) {
          const fieldId = field.$id.replace('#/definitions/fields/', '');
          combinedSchema.definitions.fields[fieldId] = field;
        }
      });

      // Add schemas to definitions
      schema.Schemas.forEach((schemaItem: any) => {
        if (schemaItem.$id) {
          const schemaId = schemaItem.$id.replace('#/definitions/objects/', '');
          combinedSchema.definitions.objects[schemaId] = schemaItem;
        }
      });

      // console.log('=== IMPORTED FIELDS DATA ===');
      // console.log(fieldsData);
      
      console.log('=== IMPORTED SCHEMAS DATA ===');
      console.log(schema);
      
      // console.log('=== COMBINED SCHEMA BEFORE DEREFERENCING ===');
      // console.log(combinedSchema);

      // Dereference the schema using json-schema-ref-parser
      this.mergedSchema = await $RefParser.dereference(combinedSchema);
      
      console.log('=== MERGED SCHEMA AFTER DEREFERENCING ===');
      console.log(this.mergedSchema);
      
      // // Update the display text
      this.mergedSchemaText = JSON.stringify(this.mergedSchema, null, 2);
      
      // // Use one of the schemas as an example for JSON Forms
      if (this.mergedSchema.definitions?.objects?.Base_InventoryInterface) {
        this.schema = this.mergedSchema.definitions.objects.Base_InventoryInterface;
        this.schemaText = JSON.stringify(this.schema, null, 2);
        
        // Generate basic UI schema
        this.uischema = this.generateUISchema(this.schema);
        this.uischemaText = JSON.stringify(this.uischema, null, 2);
        
        // Initialize data with empty values for each property
        const initialData = this.generateInitialData(this.schema);
        // Ensure this.data is an object
        if (!this.data || typeof this.data !== 'object') {
          this.data = {};
        }
        // Update existing data object instead of replacing it
        Object.keys(initialData).forEach(key => {
          this.data[key] = initialData[key];
        });
        this.dataText = JSON.stringify(this.data, null, 2);
        
        // Trigger change detection after async update
        this.cdr.detectChanges();
      }
      
    } catch (error) {
      console.error('Error merging schemas:', error);
      this.mergedSchemaText = `Error merging schemas: ${error}`;
      this.cdr.detectChanges();
    }
  }

  generateInitialData(schema: any): any {
    const data: any = {};
    console.log('Generating initial data for schema:', schema);
    
    if (schema.properties) {
      Object.keys(schema.properties).forEach((key) => {
        const property = schema.properties[key];
        console.log(`Processing property ${key}:`, property);
        
        // Handle different property types
        if (property.type) {
          if (Array.isArray(property.type)) {
            // Handle array of types like ["string"] or ["integer"]
            const primaryType = property.type[0];
            if (primaryType === 'string') {
              data[key] = property.default !== undefined ? property.default : '';
            } else if (primaryType === 'integer' || primaryType === 'number') {
              data[key] = property.default !== undefined ? property.default : 0;
            } else if (primaryType === 'boolean') {
              data[key] = property.default !== undefined ? property.default : false;
            } else if (primaryType === 'array') {
              data[key] = property.default !== undefined ? property.default : [];
            } else {
              data[key] = property.default !== undefined ? property.default : null;
            }
          } else {
            // Handle single type
            if (property.type === 'object') {
              data[key] = this.generateInitialData(property);
            } else if (property.type === 'array') {
              data[key] = property.default !== undefined ? property.default : [];
            } else if (property.type === 'boolean') {
              data[key] = property.default !== undefined ? property.default : false;
            } else if (property.type === 'string') {
              data[key] = property.default !== undefined ? property.default : '';
            } else if (property.type === 'integer' || property.type === 'number') {
              data[key] = property.default !== undefined ? property.default : 0;
            } else {
              data[key] = property.default !== undefined ? property.default : null;
            }
          }
        } else {
          // If no type specified, use default or null
          data[key] = property.default !== undefined ? property.default : null;
        }
      });
    }
    
    console.log('Generated initial data:', data);
    return data;
  }

  generateUISchema(schema: any): UISchemaElement {
    if (schema.properties) {
      const elements: any[] = [];
      Object.keys(schema.properties).forEach(key => {
        const property = schema.properties[key];
        
        // Use custom renderer for specific fields (string fields that are not readonly)
        const useCustomRenderer = property.type?.includes('string') && 
                                property.fieldType !== 'ReadOnly' &&
                                ['Id', 'name', 'Address', 'AdminEmail'].includes(key);
        
        const element: any = {
          type: 'Control',
          scope: `#/properties/${key}`
        };
        
        if (useCustomRenderer) {
          element.options = {
            customStyle: true,
            placeholder: property.description || `Enter ${property.displayName || key}`
          };
        }
        
        elements.push(element);
      });
      
      return {
        type: 'VerticalLayout',
        elements: elements
      };
    }
    
    return {
      type: 'Control',
      scope: '#'
    };
  }


  onSchemaChange(event: any) {
    try {
      const parsed = JSON.parse(event.target.value);
      this.schema = parsed;
    } catch (e) {
      // Keep the text but don't update the schema if invalid JSON
      console.warn('Invalid JSON Schema:', e);
    }
  }

  onUISchemaChange(event: any) {
    try {
      const parsed = JSON.parse(event.target.value);
      this.uischema = parsed;
    } catch (e) {
      // Keep the text but don't update the uischema if invalid JSON
      console.warn('Invalid UI Schema:', e);
    }
  }

  onDataChange(event: any) {
    console.log("onDataChange", {"event": event, "data": this.data  });
    try {
      const parsed = JSON.parse(event.target.value);
      // Ensure this.data is an object
      if (!this.data || typeof this.data !== 'object') {
        this.data = {};
      }
      // Clear existing data and add new properties
      Object.keys(this.data).forEach(key => delete this.data[key]);
      Object.keys(parsed).forEach(key => {
        this.data[key] = parsed[key];
      });
    } catch (e) {
      // Keep the text but don't update the data if invalid JSON
      console.warn('Invalid Data:', e);
    }
  }

  onJsonFormsDataChange(event: any) {
    console.log('JSON Forms data changed:', event);
    
    // The event might be empty, but we can access the current data from the form
    // Let's check both the event and try to get data from other sources
    
    if (event && typeof event === 'object' && Object.keys(event).length > 0) {
      // If event has data, use it
      Object.assign(this.data, event);
      this.dataText = JSON.stringify(this.data, null, 2);
    } else {
      // If event is empty, try to get the data from the current form state
      // We'll update the dataText with the current this.data state
      console.log('Event is empty, using current data state:', this.data);
      this.dataText = JSON.stringify(this.data, null, 2);
    }
    
    // Trigger change detection
    this.cdr.detectChanges();
  }

}
