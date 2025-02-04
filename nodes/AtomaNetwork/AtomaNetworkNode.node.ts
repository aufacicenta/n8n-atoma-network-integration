import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

export class AtomaNetworkNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Atoma Network',
		name: 'atomaNetworkNode',
		icon: 'file:atomaNetworkIcon.svg',
		group: ['transform'],
		version: 1,
		description: 'Transform text input properties with Atoma Network AI Chat completions.',
		defaults: {
			name: 'Atoma Network',
		},
		credentials: [
			{
				name: 'atomaNetworkApi',
				required: true,
			},
		],
		inputs: ['main'] as Array<NodeConnectionType>,
		outputs: ['main'] as Array<NodeConnectionType>,
		properties: [
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				default: '',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				description:
					'Select an Atoma Network model. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
			},
			{
				displayName: 'Content (JSON)',
				name: 'messages',
				type: 'json',
				default: '{{ $("input-trigger").all().map(e => e.json) }}',
				description:
					"Parse the input fields to create the 'messages' object for the Atoma Network chat completions call",
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('atomaNetworkApi');

					const responseData = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'atomaNetworkApi',
						{
							url: `${credentials.baseURL}/v1/models`,
							method: 'GET',
						},
					);

					if (responseData.success === false) {
						throw new NodeApiError(this.getNode(), responseData as JsonObject);
					}

					return responseData.data.map((m: { id: string }) => ({
						name: m.id,
						value: m.id,
						description: m.id,
					})) as INodePropertyOptions[];
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const response: INodeExecutionData[] = [];

		const itemIndex = 0;

		try {
			const credentials = await this.getCredentials('atomaNetworkApi', itemIndex);
			const baseURL = credentials.baseURL;

			const messages = this.getNodeParameter('messages', itemIndex, []);
			const model = this.getNodeParameter('model', itemIndex, '');

			const responseData = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'atomaNetworkApi',
				{
					url: `${baseURL}/v1/chat/completions`,
					method: 'POST',
					body: {
						messages,
						model,
						stream: false,
					},
				},
			);

			this.logger.info('AtomaNetworkNode::execute: ', {
				responseData,
			});

			if (responseData.success === false) {
				throw new NodeApiError(this.getNode(), responseData as JsonObject);
			}

			response.push({
				json: responseData,
			});
		} catch (error) {
			if (this.continueOnFail()) {
				response.push({ json: {}, pairedItem: itemIndex, error });
			} else {
				// Adding `itemIndex` allows other workflows to handle this error
				if (error.context) {
					// If the error thrown already contains the context property,
					// only append the itemIndex
					error.context.itemIndex = itemIndex;
					throw error;
				}

				throw new NodeOperationError(this.getNode(), error, {
					itemIndex,
				});
			}
		}

		return [response];
	}
}
