package edu.ncf.contractform;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient;
import com.amazonaws.services.dynamodbv2.model.*;
import com.google.common.collect.ImmutableMap;
import com.google.common.primitives.Longs;

public enum DynamoDBContractStore implements ContractStore {
	INSTANCE;
	private final AmazonDynamoDBClient dynamoDB;
	private final String tableName;
	private final SecureRandom random; // Used to generate contract IDs

	private DynamoDBContractStore() {
		this.dynamoDB = new AmazonDynamoDBClient(getCredentials());
		dynamoDB.setRegion(Region.getRegion(Regions.US_EAST_1));
		this.tableName = "Contracts";
		try {
			dynamoDB.describeTable(tableName); // Throws ResourceNotFoundException if does not exist
		} catch (ResourceNotFoundException e) {
			throw new RuntimeException("Could not find table " + tableName + ", does it exist?", e);
		}
		this.random = new SecureRandom();
	}

	/**
	 * Gets the AWS credentials to access the DynamoDB table "Contracts," which is owned by the "NCF Contracts" account.
	 * Looks in the .aws/credentials file in your home directory.
	 * 
	 * @return proper AWS credentials with the privileges to manipulate the "Contracts" table
	 */
	private static AWSCredentials getCredentials() {
		return new ProfileCredentialsProvider("ContractTableManager").getCredentials();
	}

	public static ContractStore instance() {
		return INSTANCE;
	}

	public static void main(String... args) {
		System.out.println("Table Description: " + INSTANCE.describeTable());
		System.out.println("Contracts: " + instance().getContractsByGoogleId("105457190982729373873"));
	}

	private TableDescription describeTable() {
		DescribeTableRequest describeTableRequest = new DescribeTableRequest().withTableName(tableName);
		TableDescription tableDescription = dynamoDB.describeTable(describeTableRequest).getTable();
		return tableDescription;
	}

	private PutItemResult insertContract(ContractEntry entry) {
		Map<String, AttributeValue> item = contractEntryToAttributeMap(entry);
		PutItemRequest putItemRequest = new PutItemRequest(tableName, item);
		PutItemResult putItemResult = dynamoDB.putItem(putItemRequest);
		return putItemResult;
	}

	public String createContract(String googleId, ContractData initialData) {
		/*
		 * This should never conflict with an existing contract ID, but we use a check down below just in case. Here is
		 * the math to justify that we should never get the same ID twice:
		 * Assume that the school has less than 1000 students at any given time, and that each year a given student
		 * creates, on average, no more than 10 contracts, and that our system is used for less than 100 years. Then the
		 * system should never contain more than 1000*10*100 = 1 million contracts. Our contract IDs are random numbers
		 * from throughout the range of Long (as guaranteed by the SecureRandom API), so there are 2^64 possible
		 * ContractID's. According to the birthday problem calculator at
		 * https://lazycackle.com/Probability_of_repeated_event_online_calculator__birthday_problem_.html,
		 * The probability of getting the same ID twice is ~2.7e-8, or 27 out of a billion, which we consider
		 * effectively impossible.
		 */
		String newContractId = longToBase64(random.nextLong());
		ContractEntry entry = new ContractEntry(newContractId, googleId, initialData,
				System.currentTimeMillis());
		Map<String, AttributeValue> item = contractEntryToAttributeMap(entry);
		/*
		 * From the DynamoDB docs:
		 * "To prevent a new item from replacing an existing item, use a conditional expression that contains the
		 *  attribute_not_exists function with the name of the attribute being used as the partition key for the table.
		 *  Since every record must contain that attribute, the attribute_not_exists function will only succeed if no
		 *  matching item exists."
		 * If we get a conditionalCheckFailedException, then our conditional expression, 
		 * 'attribute_not_exists(ContractId)', must have failed. This means we tried to insert a new item with the same
		 * ContractId as an existing item. This represents a catastrophic failure. Either there are way too many items
		 * in the database, or our randomization is broken, or our code is broken. 
		 */
		PutItemRequest putItemRequest = new PutItemRequest(tableName, item)
				.withConditionExpression("attribute_not_exists(ContractId)");
		try {
			dynamoDB.putItem(putItemRequest);
		} catch (ConditionalCheckFailedException e) {
			throw new RuntimeException(
					"Tried to create new item, but ContractId already exists; this is terrible. See comments.", e);
		}
		return newContractId;
	}

	public ContractEntry getContractByContractId(String contractId) {
		GetItemRequest getItemRequest = new GetItemRequest().withTableName(tableName).addKeyEntry("ContractId",
				new AttributeValue(contractId)).withConsistentRead(true);
		GetItemResult result = dynamoDB.getItem(getItemRequest);
		return attributeMapToContractEntry(result.getItem());
	}

	public Optional<ContractEntry> getContract(String contractId, String googleId) {
		GetItemRequest getItemRequest = new GetItemRequest().withTableName(tableName).addKeyEntry("ContractId",
				new AttributeValue(contractId)).withConsistentRead(true);
		GetItemResult result = dynamoDB.getItem(getItemRequest);
		ContractEntry entry = attributeMapToContractEntry(result.getItem());
		return Optional.of(entry).filter(e -> e.googleId.equals(googleId));
	}

	public List<ContractEntry> getContractsByGoogleId(String googleId) {
		QueryRequest req = new QueryRequest(tableName)
				.withIndexName("GoogleId-index")
				.addKeyConditionsEntry("GoogleId",
						new Condition()
								.withComparisonOperator(ComparisonOperator.EQ)
								.withAttributeValueList(new AttributeValue(googleId)));
		System.out.println("About to send query: " + System.currentTimeMillis());
		QueryResult queryResult = dynamoDB.query(req);
		List<ContractEntry> results = queryResultToContractEntries(queryResult);
		System.out.println("Just recieved results: " + System.currentTimeMillis());
		return results;
	}

	public List<ContractEntry> getAllContracts() {
		ScanRequest scanRequest = new ScanRequest(tableName);
		ScanResult scanResult = dynamoDB.scan(scanRequest);
		System.out.println("Scan result: " + scanResult);
		return attributeMapsToContractEntries(scanResult.getItems());
	}

	public void updateContract(String contractId, String googleId, ContractData newContents) {
		String dateLastModified = Long.toString(System.currentTimeMillis());
		UpdateItemRequest updateItemRequest = new UpdateItemRequest()
				.withTableName(tableName)
				.addKeyEntry("ContractId", new AttributeValue(contractId))
				.withConditionExpression("GoogleId = :google_id")
				.addExpressionAttributeValuesEntry(":google_id", new AttributeValue(googleId))
				.withUpdateExpression("SET ContractData = :contract_data, DateLastModified = :date_last_modified")
				.addExpressionAttributeValuesEntry(":contract_data", new AttributeValue(newContents.toJson()))
				.addExpressionAttributeValuesEntry(":date_last_modified", new AttributeValue().withN(dateLastModified))
				.withReturnValues(ReturnValue.ALL_NEW);
		UpdateItemResult updateResult = dynamoDB.updateItem(updateItemRequest);
		ContractEntry updatedEntry = attributeMapToContractEntry(updateResult.getAttributes());
		// System.out.println("Updated entry: " + updatedEntry);
		// return updatedEntry;
	}

	private Map<String, AttributeValue> contractEntryToAttributeMap(ContractEntry entry) {
		return ImmutableMap.<String, AttributeValue> builder()
				.put("ContractId", new AttributeValue(entry.contractId))
				.put("GoogleId", new AttributeValue(entry.googleId))
				.put("ContractData", new AttributeValue(entry.contractData.toJson()))
				.put("DateLastModified", new AttributeValue().withN(Long.toString(entry.dateLastModified)))
				.build();
	}

	private static List<ContractEntry> queryResultToContractEntries(QueryResult queryResult) {
		return queryResult.getItems().stream().map(DynamoDBContractStore::attributeMapToContractEntry)
				.collect(Collectors.toList());
	}

	private static List<ContractEntry> attributeMapsToContractEntries(List<Map<String, AttributeValue>> mapList) {
		return mapList.stream().map(DynamoDBContractStore::attributeMapToContractEntry)
				.collect(Collectors.toList());
	}

	private static ContractEntry attributeMapToContractEntry(Map<String, AttributeValue> map) {
		System.out.println(map);
		return new ContractEntry(
				map.get("ContractId").getS(),
				map.get("GoogleId").getS(),
				ContractData.fromJson(map.get("ContractData").getS()),
				Long.parseLong(map.get("DateLastModified").getN()));
	}

	private static String longToBase64(long contractId) {
		return Base64.getUrlEncoder().encodeToString(Longs.toByteArray(contractId));
	}
}
